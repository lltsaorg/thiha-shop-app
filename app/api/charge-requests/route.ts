// app/api/charge-requests/route.ts
export const runtime = "nodejs";

import {
  TAB,
  appendRow,
  getHeaderMap,
  getAllRows,
  a1,
  updateRange,
  findChargeReqRow,
  findUserRowByPhoneNumber,
} from "@/lib/sheets";
import { ChargeRequestSchema } from "@/lib/validators";
import { json, nowISO } from "@/lib/utils";
import { notifyAdmins, isPushReady } from "@/lib/push";

export const dynamic = "force-dynamic";

const uid = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2);

type ChargeRequest = {
  id: string;
  phone: string;
  amount: number;
  approved: boolean;
  createdAt: string;
  approvedAt?: string;
};

function toBool(v: any) {
  return String(v ?? "").toLowerCase() === "true";
}

// ★ GET: シートから一覧を返す（?status=pending|approved|all）
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status =
      (searchParams.get("status") as "pending" | "approved" | "all") || "all";

    // ヘッダー取得（存在しない場合は getHeaderMap が throw します）
    const hdr = await getHeaderMap(TAB.CHARGE_REQ);
    const idx = (name: string) => hdr.get(name) ?? -1;

    // 期待するヘッダ名（シート1行目）は以下：
    // id | phone | amount | approved | created_at | approved_at
    const rows = await getAllRows(TAB.CHARGE_REQ);

    const items = rows
      .map<ChargeRequest | null>((r) => {
        if (!r) return null;
        const id = r[idx("id")] ?? "";
        const phone = r[idx("phone")] ?? "";
        const amount = Number(r[idx("amount")] ?? 0);
        const approved = toBool(r[idx("approved")]);
        const createdAt = r[idx("created_at")] ?? "";
        const approvedAt = r[idx("approved_at")] || undefined;
        if (!id) return null;
        return { id, phone, amount, approved, createdAt, approvedAt };
      })
      .filter((x): x is ChargeRequest => !!x);

    const filtered =
      status === "pending"
        ? items.filter((i) => !i.approved)
        : status === "approved"
        ? items.filter((i) => i.approved)
        : items;

    return new Response(JSON.stringify({ items: filtered }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed to list charge requests" }, 500);
  }
}

// 既存：申請作成（POST）
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = ChargeRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.format() }, 400);
  const { phone, amount } = parsed.data;

  const id = uid();
  // id | phone | amount | approved | created_at | approved_at
  await appendRow(TAB.CHARGE_REQ, [id, phone, amount, "false", nowISO(), ""]);

  if (isPushReady()) {
    await notifyAdmins({
      title: "New charge request",
      body: "ユーザーからチャージ申請が来ました",
      url: "/admin/charge-requests",
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

export async function PUT(req: Request) {
  try {
    const { id } = await req.json().catch(() => ({}));
    if (!id) return json({ success: false, error: "id is required" }, 400);

    // リクエスト行を特定
    const found = await findChargeReqRow(id);
    if (!found) return json({ success: false, error: "not found" }, 404);

    const { rowIndex, header, row } = found;
    const g = (k: string) => header.get(k) ?? -1;

    const approvedIdx = g("approved");
    if (String(row[approvedIdx]).toLowerCase() === "true") {
      return json({ success: true, already: true }, 200);
    }

    const phone = row[g("phone")];
    const amount = Number(row[g("amount")] ?? 0);

    // ユーザーを特定して残高加算
    const user = await findUserRowByPhoneNumber(phone);
    if (!user) return json({ success: false, error: "user not found" }, 404);

    const u = user.row.slice(); // コピー
    const ub = user.header.get("balance")!;
    const udate = user.header.get("last_charge_date")!;
    const newBalance = Number(u[ub] ?? 0) + amount;
    u[ub] = newBalance;
    u[udate] = nowISO();

    // リクエスト行を承認済みに
    const newReq = row.slice();
    newReq[approvedIdx] = "true";
    const approvedAtIdx = g("approved_at");
    if (approvedAtIdx >= 0) newReq[approvedAtIdx] = nowISO();

    // それぞれの行を更新
    await updateRange(a1(TAB.USERS, `A${user.rowIndex}:Z${user.rowIndex}`), [
      u,
    ]);
    await updateRange(a1(TAB.CHARGE_REQ, `A${rowIndex}:Z${rowIndex}`), [
      newReq,
    ]);

    return json({ success: true, balance: newBalance }, 200);
  } catch (e: any) {
    return json({ success: false, error: e?.message ?? "approve failed" }, 500);
  }
}

// ★ OPTIONS: 念のため
export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
