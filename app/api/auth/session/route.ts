import { NextRequest, NextResponse } from "next/server";
import { USER_COOKIE, USER_MAX_AGE_SEC, createUserToken, verifyUserToken } from "@/lib/user-session";

export const runtime = "nodejs";

// Validate current session
export async function GET(req: NextRequest) {
  const token = req.cookies.get(USER_COOKIE)?.value || null;
  const v = verifyUserToken(token);
  if (!v.ok) {
    return NextResponse.json(
      { ok: false },
      {
        status: 401,
        headers: {
          "cache-control": "no-store",
        },
      }
    );
  }
  return NextResponse.json(
    { ok: true, phone: v.phone },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
}

// Create/update session cookie for given phone
export async function POST(req: NextRequest) {
  const data = await req.json().catch(() => ({} as any));
  const phone = String(data?.phone || "").trim();
  if (!phone) return NextResponse.json({ ok: false, error: "phone required" }, { status: 400 });

  const token = createUserToken(phone);
  const res = NextResponse.json(
    { ok: true },
    {
      headers: {
        "cache-control": "no-store",
      },
    }
  );
  res.cookies.set({
    name: USER_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: USER_MAX_AGE_SEC,
  });
  return res;
}
