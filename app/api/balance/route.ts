// /app/api/balance/route.ts
import { getBalanceFast, BAL_TTL } from "@/lib/db";
import { USER_COOKIE, verifyUserToken } from "@/lib/user-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  let phone = new URL(req.url).searchParams.get("phone")?.trim();
  if (!phone) {
    const cookie = (req as any).headers?.get?.("cookie") || "";
    const token = cookie
      .split(/;\s*/)
      .map((p: string) => p.split("=", 2))
      .find(([k]: string[]) => k === USER_COOKIE)?.[1];
    const v = verifyUserToken(token ? decodeURIComponent(token) : null);
    if (v.ok && v.phone) phone = v.phone;
  }
  if (!phone) {
    return new Response(JSON.stringify({ error: "phone required" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const snap = await getBalanceFast(phone);

  // 404にせず、200 + {exists:false} を返す
  if (!snap?.exists) {
    return new Response(JSON.stringify({ exists: false }), {
      status: 200,
      headers: {
        "content-type": "application/json",
        // Avoid stale CDN/browser cache after purchase
        "cache-control": "no-store",
        "x-bal-ttl": String(BAL_TTL),
        "x-server-time": new Date().toISOString(),
      },
    });
  }

  // 見つかった場合は exists:true を明示して返す
  return new Response(
    JSON.stringify({
      exists: true,
      phone,
      balance: snap.balance,
      last_charge_date: snap.last_charge_date,
    }),
    {
      status: 200,
      headers: {
        "content-type": "application/json",
        // Avoid stale CDN/browser cache after purchase
        "cache-control": "no-store",
        "x-bal-ttl": String(BAL_TTL),
        "x-server-time": new Date().toISOString(),
      },
    }
  );
}
