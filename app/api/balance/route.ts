// /app/api/balance/route.ts
import { getBalanceFast, BAL_TTL } from "@/lib/db";
import {
  createExpiredUserCookieHeader,
  getUserTokenFromCookieHeader,
  validateUserToken,
} from "@/lib/user-session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  let phone = new URL(req.url).searchParams.get("phone")?.trim();
  const cookieHeader = (req as any).headers?.get?.("cookie") || "";
  const token = getUserTokenFromCookieHeader(cookieHeader);
  if (token) {
    const session = await validateUserToken(token);
    if (!session.ok) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: {
          "content-type": "application/json",
          "cache-control": "no-store",
          "set-cookie": createExpiredUserCookieHeader(),
        },
      });
    }
    if (!phone) phone = session.phone;
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
