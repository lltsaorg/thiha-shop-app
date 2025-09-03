// app/api/me/charge-requests/route.ts
export const runtime = "nodejs";

import { supabase, findUserIdByPhone } from "@/lib/db";
import { USER_COOKIE, verifyUserToken } from "@/lib/user-session";
import { json } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/me/charge-requests?phone=...&status=pending|approved|all&limit=&offset=
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let phone = (searchParams.get("phone") || "").trim();
    if (!phone) {
      const cookie = (req as any).headers?.get?.("cookie") || "";
      const token = cookie
        .split(/;\s*/)
        .map((p: string) => p.split("=", 2))
        .find(([k]: string[]) => k === USER_COOKIE)?.[1];
      const v = verifyUserToken(token ? decodeURIComponent(token) : null);
      if (v.ok && v.phone) phone = v.phone;
    }
    if (!phone) return json({ error: "phone required" }, 401);

    const status =
      (searchParams.get("status") as "pending" | "approved" | "all") || "all";
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") ?? 50), 1),
      50
    );
    const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

    const userId = await findUserIdByPhone(phone);
    if (!userId) return json({ items: [] });

    let query = supabase
      .from("ChargeRequests")
      .select(
        "id,amount,approved,requested_at,approved_at"
      )
      .eq("user_id", userId)
      .order("requested_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (status === "pending") query = query.eq("approved", false);
    if (status === "approved") query = query.eq("approved", true);

    const { data, error } = await query;
    if (error) return json({ error: error.message }, 500);
    const items = (data ?? []).map((r: any) => ({
      id: r.id,
      amount: Number(r.amount ?? 0),
      approved: !!r.approved,
      requested_at: r.requested_at ?? "",
      approved_at: r.approved_at ?? "",
    }));
    return json({ items });
  } catch (e: any) {
    return json({ error: e?.message ?? "failed" }, 500);
  }
}
