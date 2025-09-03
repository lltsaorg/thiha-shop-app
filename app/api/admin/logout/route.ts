import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
import { getGateCookieName } from "@/lib/gate-auth";

export async function GET(req: NextRequest) {
  const url = new URL("/admin/login", req.nextUrl);
  // 303 for consistency (ensures a GET request after redirect)
  const res = NextResponse.redirect(url, { status: 303 });
  res.cookies.set({
    name: getGateCookieName(),
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return res;
}

