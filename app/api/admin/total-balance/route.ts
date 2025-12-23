import { NextRequest } from "next/server";
import { getGateCookieName, verifyToken } from "@/lib/gate-auth";
import { getTotalUserBalanceFast, TOTAL_BAL_TTL } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(getGateCookieName())?.value ?? null;
  if (!verifyToken(token)) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { "content-type": "application/json" },
    });
  }

  const total = await getTotalUserBalanceFast();
  return new Response(JSON.stringify({ total_balance: total }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
      "x-total-bal-ttl": String(TOTAL_BAL_TTL),
      "x-server-time": new Date().toISOString(),
    },
  });
}
