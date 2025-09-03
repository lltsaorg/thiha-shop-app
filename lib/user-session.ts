import crypto from "crypto";

export const USER_COOKIE = "USER_SESSION";
const USER_DEFAULT_MAX_AGE = 60 * 60 * 24 * 7; // 7 days
const USER_ENV_MAX = Number(process.env.APP_USER_MAX_AGE_SEC);
export const USER_MAX_AGE_SEC =
  Number.isFinite(USER_ENV_MAX) && USER_ENV_MAX > 0
    ? Math.floor(USER_ENV_MAX)
    : USER_DEFAULT_MAX_AGE;

type Payload = { v: 1; phone: string; iat: number; exp: number };

export function getUserSecret(): string {
  const s = process.env.APP_USER_SESSION_SECRET || process.env.APP_GATE_PASS;
  if (!s) throw new Error("APP_USER_SESSION_SECRET is not set");
  return s;
}

export function createUserToken(phone: string, maxAgeSec = USER_MAX_AGE_SEC) {
  const now = Math.floor(Date.now() / 1000);
  const payload: Payload = { v: 1, phone, iat: now, exp: now + maxAgeSec };
  const json = JSON.stringify(payload);
  const b64 = base64urlEncode(Buffer.from(json));
  const sig = sign(b64, getUserSecret());
  return `${b64}.${sig}`;
}

export function verifyUserToken(token?: string | null): {
  ok: boolean;
  phone?: string;
} {
  if (!token) return { ok: false };
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return { ok: false };
  const expected = sign(b64, getUserSecret());
  if (!timingSafeEqual(sig, expected)) return { ok: false };
  try {
    const json = Buffer.from(base64urlDecode(b64)).toString("utf8");
    const payload = JSON.parse(json) as Payload;
    if (payload.v !== 1) return { ok: false };
    const now = Math.floor(Date.now() / 1000);
    if (now > payload.exp) return { ok: false };
    return { ok: true, phone: payload.phone };
  } catch {
    return { ok: false };
  }
}

function sign(data: string, secret: string): string {
  return base64urlEncode(
    crypto.createHmac("sha256", secret).update(data).digest()
  );
}

function base64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? 0 : 4 - (str.length % 4);
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  return Buffer.from(base64, "base64");
}

function timingSafeEqual(a: string, b: string) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}
