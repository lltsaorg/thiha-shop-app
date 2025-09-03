// /app/api/balance/route.ts
import { getBalanceFast } from "@/lib/db";
import { USER_COOKIE, verifyUserToken } from "@/lib/user-session";

export const dynamic = "force-dynamic";

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
        "cache-control": "public, max-age=2",
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
        "cache-control": "public, max-age=2",
      },
    }
  );
}
