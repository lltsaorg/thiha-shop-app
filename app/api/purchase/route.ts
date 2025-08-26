// /app/api/purchase/route.ts
import {
  TAB,
  findUserRowByPhoneNumber,
  appendRow,
  updateRange,
  a1,
  invalidateBalanceCache,
} from "@/lib/sheets";
import { PurchaseSchema } from "@/lib/validators";
import { json, nowISO } from "@/lib/utils";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = PurchaseSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.format() }, 400);

  const { phone, items } = parsed.data;

  // ユーザーが存在しない場合は購入を拒否
  const u = await findUserRowByPhoneNumber(phone);
  if (!u) return json({ error: "unknown phone" }, 400);

  const current = Number(u.row[u.header.get("balance")!] ?? 0);

  // フロント計算を採用 → quantity/total_amount に正規化
  const normalized = items.map((it) => ({
    product_id: it.product_id,
    quantity: (it.quantity ?? it.qty)!,
    total_amount: (it.total_amount ?? it.total)!,
  }));

  // Transactions に [timestamp, phone, product_id, quantity, total_amount]
  for (const it of normalized) {
    await appendRow(TAB.TX, [
      nowISO(),
      phone,
      it.product_id,
      it.quantity,
      it.total_amount,
    ]);
  }

  const grand = normalized.reduce(
    (s, it) => s + Number(it.total_amount || 0),
    0
  );
  const after = current - grand;

  // Users.balance 更新
  const balIdx = u.header.get("balance")!;
  u.row[balIdx] = after;
  await updateRange(a1(TAB.USERS, `A${u.rowIndex}:Z${u.rowIndex}`), [u.row]);

  invalidateBalanceCache(phone);
  return json({ ok: true, total: grand, balance_after: after });
}
