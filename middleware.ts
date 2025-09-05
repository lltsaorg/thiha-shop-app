import { NextResponse, NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Only guard real page navigations to reduce Edge Requests for assets/XHR
  // - Method must be GET (HEAD/POST などは素通し)
  // - Prefer Sec-Fetch headers when available (mode:navigate or dest:document)
  // - Fallback to Accept: text/html
  const method = req.method.toUpperCase();
  if (method !== "GET") return NextResponse.next();
  const secFetchMode = req.headers.get("sec-fetch-mode") || ""; // e.g., navigate, cors, no-cors
  const secFetchDest = req.headers.get("sec-fetch-dest") || ""; // e.g., document, script, image
  const accept = req.headers.get("accept") || "";
  const isDocNavigation =
    secFetchMode === "navigate" ||
    secFetchDest === "document" ||
    accept.includes("text/html");
  if (!isDocNavigation) return NextResponse.next();

  // Allow the login page and API endpoints to pass
  if (
    pathname === "/admin/login" ||
    pathname.startsWith("/api/admin/login") ||
    pathname.startsWith("/api/admin/logout")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(COOKIE_NAME);
  const ok = await verifyTokenEdge(cookie?.value || null);
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/admin/login";
  url.search = new URLSearchParams({ next: `${pathname}${search || ""}` }).toString();
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/admin/:path*"],
};

const COOKIE_NAME = "ADMIN_GATE";

async function verifyTokenEdge(token: string | null): Promise<boolean> {
  if (!token) return false;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return false;
  const secret = process.env.APP_GATE_PASS;
  if (!secret) return false;
  try {
    const expected = await signEdge(b64, secret);
    if (!timingSafeEqual(sig, expected)) return false;
    const json = new TextDecoder().decode(base64urlDecode(b64));
    const payload = JSON.parse(json) as { v: number; iat: number; exp: number };
    if (payload.v !== 1) return false;
    const now = Math.floor(Date.now() / 1000);
    if (now > payload.exp) return false;
    return true;
  } catch {
    return false;
  }
}

async function signEdge(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data)
  );
  return base64urlEncode(new Uint8Array(sig));
}

function base64urlEncode(buf: Uint8Array): string {
  let str = btoa(String.fromCharCode(...buf));
  return str.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlDecode(str: string): Uint8Array {
  const pad = str.length % 4 === 0 ? 0 : 4 - (str.length % 4);
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
