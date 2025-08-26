// /app/api/admin/charge-requests/approve/route.ts
import {
  TAB,
  findChargeReqRow,
  updateRange,
  findUserRowByPhoneNumber,
  appendRow,
  a1,
  invalidateBalanceCache,
} from "@/lib/sheets";
import { json, nowISO } from "@/lib/utils";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { id } = await req.json().catch(() => ({}));
  if (!id) return json({ error: "id required" }, 400);

  const f = await findChargeReqRow(String(id));
  if (!f) return json({ error: "not found" }, 404);

  const { rowIndex, header, row } = f;
  const approvedIdx = header.get("approved")!;
  if ((row[approvedIdx] ?? "false") === "true")
    return json({ ok: true, already: true });

  const phone = row[header.get("phone")!] as string; // ChargeRequests 側は従来通り phone 列想定
  const amount = Number(row[header.get("amount")!] ?? 0);

  // 承認マーク
  row[approvedIdx] = "true";
  row[header.get("approved_at")!] = nowISO();
  await updateRange(a1(TAB.CHARGE_REQ, `A${rowIndex}:Z${rowIndex}`), [row]);

  // Users に反映（phone 列）
  const user = await findUserRowByPhoneNumber(phone);
  const now = nowISO();
  if (user) {
    const balIdx = user.header.get("balance")!;
    const lcdIdx = user.header.get("last_charge_date")!;
    user.row[balIdx] = Number(user.row[balIdx] ?? 0) + amount;
    user.row[lcdIdx] = now;
    await updateRange(a1(TAB.USERS, `A${user.rowIndex}:Z${user.rowIndex}`), [
      user.row,
    ]);
  } else {
    // ありえない想定だが保険（登録画面経由で作られているはず）
    await appendRow(TAB.USERS, [phone, amount, now]);
  }

  invalidateBalanceCache(phone);
  return json({ ok: true });
}
