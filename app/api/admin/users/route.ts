import { NextRequest } from "next/server";
import { getGateCookieName, verifyToken } from "@/lib/gate-auth";
import {
  getTotalUserBalanceFast,
  invalidateBalanceCache,
  supabase,
} from "@/lib/db";
import { getQueue } from "@/lib/queues";
import { json } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function ensureAdmin(req: NextRequest) {
  const token = req.cookies.get(getGateCookieName())?.value ?? null;
  return verifyToken(token);
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

    const { data, error } = await supabase
      .from("Users")
      .select("id,phone_number,balance")
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return json({ error: error.message }, 500);

    const items = (data ?? []).map((row: any) => ({
      id: String(row.id),
      phone_number: row.phone_number ?? "",
      balance: Number(row.balance ?? 0),
    }));

    return json({ items, hasMore: items.length >= limit });
  } catch (e: any) {
    return json({ error: e?.message ?? "failed to load users" }, 500);
  }
}

export async function DELETE(req: NextRequest) {
  if (!ensureAdmin(req)) {
    return json({ error: "unauthorized" }, 401);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const id = body?.id;
    if (id == null || String(id).trim() === "") {
      return json({ success: false, error: "id is required" }, 400);
    }

    const userId = String(id);
    const queue = getQueue(`admin:user-delete:${userId}`, 1, 1000);

    try {
      const resp = await queue.add(async () => {
        const { data: user, error: userErr } = await supabase
          .from("Users")
          .select("id,phone_number,balance")
          .eq("id", userId)
          .maybeSingle();

        if (userErr) {
          return json({ success: false, error: userErr.message }, 500);
        }
        if (!user) {
          return json({ success: false, error: "user not found" }, 404);
        }

        const beforeTotalBalance = await getTotalUserBalanceFast();
        const deletedBalance = Number(user.balance ?? 0);

        const { error: deleteErr } = await supabase
          .from("Users")
          .delete()
          .eq("id", userId);

        if (deleteErr) {
          return json({ success: false, error: deleteErr.message }, 500);
        }

        invalidateBalanceCache(String(user.phone_number ?? ""));
        const afterTotalBalance = await getTotalUserBalanceFast();
        const expectedTotalBalance = beforeTotalBalance - deletedBalance;
        const verified = afterTotalBalance === expectedTotalBalance;

        return json({
          success: true,
          deleted_user: {
            id: String(user.id),
            phone_number: user.phone_number ?? "",
            balance: deletedBalance,
          },
          balance_verification: {
            before_total_balance: beforeTotalBalance,
            deleted_user_balance: deletedBalance,
            after_total_balance: afterTotalBalance,
            expected_total_balance: expectedTotalBalance,
            verified,
          },
        });
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
      return json({ success: false, error: e?.message ?? "delete failed" }, 500);
    }
  } catch (e: any) {
    return json({ success: false, error: e?.message ?? "delete failed" }, 500);
  }
}
