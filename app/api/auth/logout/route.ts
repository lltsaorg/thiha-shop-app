import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE } from "@/lib/user-session";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: USER_COOKIE,
    value: "",
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return res;
}

