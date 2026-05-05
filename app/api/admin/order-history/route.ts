import { NextRequest } from "next/server";
import { getGateCookieName, verifyToken } from "@/lib/gate-auth";
import { invalidateBalanceCache, supabase } from "@/lib/db";
import { getQueue } from "@/lib/queues";
import { json } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TransactionRow = {
  id: string | number;
  user_id: string | number;
  product_id: string | number | null;
  quantity: number | null;
  total_amount: number | null;
  created_at: string | null;
  Users?: { phone_number?: string | null } | null;
  Products?: { name?: string | null } | null;
};

type OrderHistoryItem = {
  order_key: string;
  user_id: string;
  created_at: string;
  transaction_ids: string[];
  phone: string;
  product_lines: string[];
  total_amount: number;
};

function ensureAdmin(req: NextRequest) {
  const token = req.cookies.get(getGateCookieName())?.value ?? null;
  return verifyToken(token);
}

function toOrderKey(userId: string | number, createdAt: string) {
  return `${String(userId)}::${createdAt}`;
}

function appendGroupedTransactions(
  grouped: Map<string, OrderHistoryItem>,
  rows: TransactionRow[],
) {

  for (const row of rows) {
    const createdAt = row.created_at ?? "";
    if (!createdAt) continue;
    const key = toOrderKey(row.user_id, createdAt);
    const quantity = Math.max(1, Number(row.quantity ?? 1));
    const productName =
      row.Products?.name?.trim() || `Product #${String(row.product_id ?? "-")}`;
    const line = `${productName} x${quantity}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        order_key: key,
        user_id: String(row.user_id),
        created_at: createdAt,
        transaction_ids: [],
        phone: row.Users?.phone_number ?? "-",
        product_lines: [],
        total_amount: 0,
      });
    }

    const item = grouped.get(key)!;
    item.transaction_ids.push(String(row.id));
    item.product_lines.push(line);
    item.total_amount += Number(row.total_amount ?? 0);
  }

}

export async function GET(req: NextRequest) {
  if (!ensureAdmin(req)) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") ?? 20), 1),
      20,
    );
    const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);
    const rowBatchSize = 200;

    let rowOffset = 0;
    let exhausted = false;
    const grouped = new Map<string, OrderHistoryItem>();

    while (!exhausted && grouped.size < offset + limit + 1) {
      const { data, error } = await supabase
        .from("Transactions")
        .select(
          "id,user_id,product_id,quantity,total_amount,created_at, Users(phone_number), Products(name)",
        )
        .order("created_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .range(rowOffset, rowOffset + rowBatchSize - 1);

      if (error) return json({ error: error.message }, 500);

      const rows = (data ?? []) as TransactionRow[];
      appendGroupedTransactions(grouped, rows);

      if (rows.length < rowBatchSize) {
        exhausted = true;
      } else {
        rowOffset += rowBatchSize;
      }
    }

    const allItems = Array.from(grouped.values());
    const items = allItems.slice(offset, offset + limit);
    const hasMore = allItems.length > offset + limit || !exhausted;

    return json({ items, hasMore });
  } catch (e: any) {
    return json({ error: e?.message ?? "failed to load order history" }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  if (!ensureAdmin(req)) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const idsRaw = Array.isArray(body?.transaction_ids) ? body.transaction_ids : [];
    const ids = idsRaw
      .map((id: unknown) => Number(id))
      .filter((id: number) => Number.isFinite(id));

    if (ids.length === 0) {
      return json({ success: false, error: "transaction_ids are required" }, 400);
    }

    const { data: seedRows, error: seedErr } = await supabase
      .from("Transactions")
      .select("user_id")
      .in("id", ids)
      .limit(1);

    if (seedErr) return json({ success: false, error: seedErr.message }, 500);
    const seedUserId = seedRows?.[0]?.user_id;
    if (seedUserId == null) {
      return json({ success: false, error: "transactions not found" }, 404);
    }

    const queue = getQueue(`user:${String(seedUserId)}`, 1, 1000);

    try {
      const resp = await queue.add(async () => {
        const { data: rows, error: rowsErr } = await supabase
          .from("Transactions")
          .select("id,user_id,total_amount,created_at")
          .in("id", ids)
          .order("id", { ascending: true });

        if (rowsErr) {
          return json({ success: false, error: rowsErr.message }, 500);
        }

        const txRows = rows ?? [];
        if (txRows.length !== ids.length) {
          return json({ success: false, error: "some transactions are missing" }, 404);
        }

        const userIds = new Set(txRows.map((row: any) => String(row.user_id)));
        const createdAts = new Set(txRows.map((row: any) => String(row.created_at ?? "")));
        if (userIds.size !== 1 || createdAts.size !== 1) {
          return json({ success: false, error: "transactions do not match one order" }, 409);
        }

        const userId = txRows[0].user_id as string | number;
        const totalAmount = txRows.reduce(
          (sum: number, row: any) => sum + Number(row.total_amount ?? 0),
          0,
        );

        const { data: user, error: userErr } = await supabase
          .from("Users")
          .select("phone_number,balance")
          .eq("id", userId)
          .maybeSingle();

        if (userErr || !user) {
          return json({ success: false, error: "user not found" }, 404);
        }

        const currentBalance = Number(user.balance ?? 0);
        const newBalance = currentBalance + totalAmount;

        const { error: updateErr } = await supabase
          .from("Users")
          .update({ balance: newBalance })
          .eq("id", userId);
        if (updateErr) {
          return json({ success: false, error: updateErr.message }, 500);
        }

        const { error: deleteErr } = await supabase
          .from("Transactions")
          .delete()
          .in("id", ids);
        if (deleteErr) {
          await supabase.from("Users").update({ balance: currentBalance }).eq("id", userId);
          return json({ success: false, error: deleteErr.message }, 500);
        }

        invalidateBalanceCache(user.phone_number as string);
        return json({ success: true, balance: newBalance });
      });

      return resp;
    } catch (e: any) {
      if (e?.code === "QUEUE_LIMIT") {
        return new Response(
          JSON.stringify({ success: false, error: "Processing" }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
              "x-wait-reason": "Processing, please wait...",
            },
          },
        );
      }
      return json({ success: false, error: e?.message ?? "cancel failed" }, 500);
    }
  } catch (e: any) {
    return json({ success: false, error: e?.message ?? "cancel failed" }, 500);
  }
}
