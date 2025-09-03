import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
import { createToken, getGateCookieName, GATE_MAX_AGE_SEC } from "@/lib/gate-auth";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const pass = String(form.get("pass") || "");
  const next = String(form.get("next") || "/admin");

  const expected = process.env.APP_GATE_PASS;
  if (!expected) {
    return NextResponse.json(
      { error: "APP_GATE_PASS is not set" },
      { status: 500 }
    );
  }

  if (pass !== expected) {
    const url = new URL("/admin/login", req.nextUrl);
    url.searchParams.set("error", "1");
    url.searchParams.set("next", next);
    // Use 303 to convert POST -> GET on redirect to avoid 405
    return NextResponse.redirect(url, { status: 303 });
  }

  const token = createToken();
  // Use 303 to convert POST -> GET to /admin (prevents 405 on /admin)
  const res = NextResponse.redirect(new URL(next, req.nextUrl), { status: 303 });
  res.cookies.set({
    name: getGateCookieName(),
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: GATE_MAX_AGE_SEC,
  });
  return res;
}
