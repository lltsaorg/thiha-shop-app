// app/api/me/purchases/route.ts
export const runtime = "nodejs";

import { supabase, findUserIdByPhone } from "@/lib/db";
import { USER_COOKIE, verifyUserToken } from "@/lib/user-session";
import { json } from "@/lib/utils";

export const dynamic = "force-dynamic";

// GET /api/me/purchases?phone=...&limit=&offset=
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    let phone = (searchParams.get("phone") || "").trim();
    if (!phone) {
      // Fallback to cookie-based session
      const cookie = (req as any).headers?.get?.("cookie") || "";
      const token = cookie
        .split(/;\s*/)
        .map((p: string) => p.split("=", 2))
        .find(([k]: string[]) => k === USER_COOKIE)?.[1];
      const v = verifyUserToken(token ? decodeURIComponent(token) : null);
      if (v.ok && v.phone) phone = v.phone;
    }
    if (!phone) return json({ error: "phone required" }, 401);
    const limit = Math.min(
      Math.max(Number(searchParams.get("limit") ?? 50), 1),
      50
    );
    const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

    const userId = await findUserIdByPhone(phone);
    if (!userId) return json({ items: [] });

    // Try to include product info if FK is set; otherwise just return product_id
    const { data, error } = await supabase
      .from("Transactions")
      .select(
        "id,created_at,product_id,quantity,total_amount, Products(name,price)"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) return json({ error: error.message }, 500);

    const items = (data ?? []).map((r: any) => ({
      id: r.id,
      created_at: r.created_at ?? "",
      product_id: r.product_id,
      quantity: Number(r.quantity ?? 0),
      total_amount: Number(r.total_amount ?? 0),
      product_name: r?.Products?.name ?? undefined,
      product_price: r?.Products?.price != null ? Number(r.Products.price) : undefined,
    }));
    return json({ items });
  } catch (e: any) {
    return json({ error: e?.message ?? "failed" }, 500);
  }
}
