// /lib/sheets.ts
import { google } from "googleapis";
import { cached, delCache } from "@/lib/cache";

const { SHEET_ID, GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY } = process.env;
if (!SHEET_ID || !GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY) {
  throw new Error("Missing Sheets env vars");
}

const auth = new google.auth.JWT({
  email: GOOGLE_CLIENT_EMAIL,
  key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const api = google.sheets({ version: "v4", auth });

/** タブ名（envで上書き可）。Users は phone 列を前提 */
export const TAB = {
  PRODUCTS: process.env.SHEET_TAB_PRODUCTS ?? "Products",
  USERS: process.env.SHEET_TAB_USERS ?? "Users",
  TX: process.env.SHEET_TAB_TRANSACTIONS ?? "Transactions",
  CHARGE_REQ: process.env.SHEET_TAB_CHARGE_REQUESTS ?? "ChargeRequests",
  SUBS: process.env.SHEET_TAB_ADMIN_SUBS ?? "AdminSubscriptions",
} as const;

export function a1(sheetTitle: string, range: string) {
  const safe = sheetTitle.replace(/'/g, "''");
  return `'${safe}'!${range}`;
}

export async function getValues(range: string) {
  const res = await api.spreadsheets.values.get({
    spreadsheetId: SHEET_ID!,
    range,
  });
  return res.data.values ?? [];
}

export async function appendRow(sheet: string, row: any[]) {
  await api.spreadsheets.values.append({
    spreadsheetId: SHEET_ID!,
    range: a1(sheet, "A1"),
    valueInputOption: "USER_ENTERED",
    requestBody: { values: [row] },
  });
}

export async function updateRange(range: string, values: any[][]) {
  await api.spreadsheets.values.update({
    spreadsheetId: SHEET_ID!,
    range,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

/** 1行目のヘッダ（5分キャッシュ） */
export async function getHeaderMap(sheet: string) {
  return cached<Map<string, number>>(
    `hdr:${sheet}`,
    5 * 60 * 1000,
    async () => {
      const values = await getValues(a1(sheet, "A1:Z1"));
      const header = values[0];
      if (!header) throw new Error(`Missing header in sheet: ${sheet}`);
      const m = new Map<string, number>();
      header.forEach((h: string, i: number) => m.set(h, i));
      return m;
    }
  );
}

/** 2行目以降を全件取得 */
export async function getAllRows(sheet: string) {
  return await getValues(a1(sheet, "A2:Z"));
}

/** Users: phone で検索（結果を 2 秒キャッシュ） */
const BAL_TTL = Number(process.env.BALANCE_CACHE_TTL_MS ?? 2000);
export async function getBalanceFast(phoneNumber: string) {
  return cached<{
    exists: boolean;
    balance: number;
    last_charge_date: string;
    rowIndex?: number;
    header?: Map<string, number>;
    row?: any[];
  }>(`bal:${phoneNumber}`, BAL_TTL, async () => {
    const header = await getHeaderMap(TAB.USERS);
    const phoneIdx = header.get("phone")!;
    const balIdx = header.get("balance")!;
    const lcdIdx = header.get("last_charge_date")!;
    const rows = await getAllRows(TAB.USERS);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if ((r[phoneIdx] ?? "") === phoneNumber) {
        return {
          exists: true,
          balance: Number(r[balIdx] ?? 0),
          last_charge_date: r[lcdIdx] ?? "",
          rowIndex: i + 2,
          header,
          row: r,
        };
      }
    }
    return { exists: false, balance: 0, last_charge_date: "" };
  });
}
export function invalidateBalanceCache(phoneNumber: string) {
  delCache(`bal:${phoneNumber}`);
}

/** 1回もの検索（更新時などに使用） */
export async function findUserRowByPhoneNumber(phoneNumber: string) {
  const header = await getHeaderMap(TAB.USERS);
  const phoneIdx = header.get("phone")!;
  const rows = await getAllRows(TAB.USERS);
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][phoneIdx] ?? "") === phoneNumber) {
      return { rowIndex: i + 2, header, row: rows[i] };
    }
  }
  return null;
}

export async function findChargeReqRow(id: string) {
  const header = await getHeaderMap(TAB.CHARGE_REQ);
  const idIdx = header.get("id")!;
  const rows = await getAllRows(TAB.CHARGE_REQ);
  for (let i = 0; i < rows.length; i++) {
    if ((rows[i][idIdx] ?? "") === id) {
      return { rowIndex: i + 2, header, row: rows[i] };
    }
  }
  return null;
}
