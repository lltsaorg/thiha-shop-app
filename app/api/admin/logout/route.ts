import { NextRequest, NextResponse } from "next/server";
import { getGateCookieName } from "@/lib/gate-auth";

export async function GET(req: NextRequest) {
  const url = new URL("/admin/login", req.nextUrl);
  const res = NextResponse.redirect(url);
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

