// app/api/charge-requests/route.ts
export const runtime = "nodejs";

import { supabase, invalidateBalanceCache } from "@/lib/db";
import { getQueue } from "@/lib/queues";
import { ChargeRequestSchema } from "@/lib/validators";
import { json, nowISO } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET: /api/charge-requests?status=pending|approved|all
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const status =
      (searchParams.get("status") as "pending" | "approved" | "all") || "all";
    // Pagination (default: 50, max: 50)
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") ?? 50), 1),
      50
    );
    const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

    let query = supabase
      .from("ChargeRequests")
      .select(
        "id,user_id,amount,approved,requested_at,approved_at, Users(phone_number,balance,last_charge_date)"
      )
      // まず requested_at の降順、次に id の降順で安定ソート
      .order("requested_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      // ページネーションでメモリとペイロードを抑制
      .range(offset, offset + limit - 1);
    if (status === "pending") query = query.eq("approved", false);
    if (status === "approved") query = query.eq("approved", true);
    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    const items = (data ?? []).map((r: any) => {
      const { Users, ...rest } = r;
      return {
        ...rest,
        phone: Users?.phone_number,
        currentBalance: Users?.balance,
        last_charge_date: Users?.last_charge_date,
      };
    });
    return json({ items });
  } catch (e: any) {
    return json({ error: e?.message ?? "Failed to list charge requests" }, 500);
  }
}

// POST: create new charge request
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = ChargeRequestSchema.safeParse(body);
    if (!parsed.success) return json({ error: parsed.error.format() }, 400);
    const { phone, amount } = parsed.data;

    // ユーザー解決の高速化:
    // - 新規ユーザー: insert + returning id（1往復）
    // - 既存ユーザー: 一意制約で失敗→phoneでid取得（2往復）
    // 先にSELECTでid取得（既存は1往復）。無ければINSERTしてid取得。
    let userId: string | number | undefined = await (async () => {
      const { data, error } = await supabase
        .from("Users")
        .select("id")
        .eq("phone_number", phone)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return (data?.id as any) ?? undefined;
    })();
    if (!userId) {
      const { data: newUser, error: insErr } = await supabase
        .from("Users")
        .insert({ phone_number: phone, balance: 0 })
        .select("id")
        .single();
      if (insErr) return json({ error: insErr.message }, 500);
      userId = (newUser?.id as any) ?? undefined;
      if (!userId) {
        const { data: refetched, error: refErr } = await supabase
          .from("Users")
          .select("id")
          .eq("phone_number", phone)
          .maybeSingle();
        if (refErr || !refetched)
          return json(
            { error: refErr?.message ?? "failed to resolve user" },
            500
          );
        userId = refetched.id as any;
      }
    }

    if (userId == null)
      return json({ error: "failed to resolve user id" }, 500);
    // 解決したユーザーに対してチャージ申請を作成
    const { data: inserted, error } = await supabase
      .from("ChargeRequests")
      .insert({
        user_id: userId,
        amount,
        approved: false,
      })
      .select("id")
      .single();
    if (error) return json({ error: error.message }, 500);

    return json({ success: true, id: inserted.id });
  } catch (e: any) {
    return json(
      { error: e?.message ?? "Failed to create charge request" },
      500
    );
  }
}

// PUT: approve charge request {id}
export async function PUT(req: Request) {
  try {
    const { id } = await req.json().catch(() => ({}));
    if (id == null)
      return json({ success: false, error: "id is required" }, 400);
    // bigintの可能性があるため数値に変換して扱う
    const idNum = Number(id);
    if (!Number.isFinite(idNum))
      return json({ success: false, error: "invalid id" }, 400);

    const { data: reqData, error: reqErr } = await supabase
      .from("ChargeRequests")
      .select("user_id,amount,approved")
      .eq("id", idNum)
      .maybeSingle();
    if (reqErr || !reqData)
      return json({ success: false, error: "not found" }, 404);
    if (reqData.approved) return json({ success: true, already: true }, 200);

    const userId = reqData.user_id as string | number;
    const amount = Number(reqData.amount ?? 0);
    const now = nowISO();
    const queue = getQueue(`user:${userId}`, 1, 1000);
    try {
      const resp = await queue.add(async () => {
        await supabase
          .from("ChargeRequests")
          .update({ approved: true })
          .eq("id", idNum);

        const { data: user } = await supabase
          .from("Users")
          .select("phone_number,balance")
          .eq("id", userId)
          .maybeSingle();
        if (!user)
          return json({ success: false, error: "user not found" }, 404);
        const phone = user.phone_number as string;
        const newBalance = Number(user.balance ?? 0) + amount;
        await supabase
          .from("Users")
          .update({ balance: newBalance, last_charge_date: now })
          .eq("id", userId);

        invalidateBalanceCache(phone);
        return json({ success: true, balance: newBalance }, 200);
      });
      return resp;
    } catch (e: any) {
      if (e?.code === "QUEUE_LIMIT")
        return new Response(
          JSON.stringify({ success: false, error: "Processing" }),
          {
            status: 429,
            headers: {
              "content-type": "application/json",
              "cache-control": "no-store",
              "x-wait-reason": "Processing, please wait...",
            },
          }
        );
      return json(
        { success: false, error: e?.message ?? "approve failed" },
        500
      );
    }
  } catch (e: any) {
    return json({ success: false, error: e?.message ?? "approve failed" }, 500);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}
