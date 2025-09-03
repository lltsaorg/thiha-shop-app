import crypto from "crypto";

const COOKIE_NAME = "ADMIN_GATE";

export const GATE_MAX_AGE_SEC = 60 * 60 * 24 * 7; // 7 days

export function getGateCookieName() {
  return COOKIE_NAME;
}

export function getGateSecret(): string {
  const secret = process.env.APP_GATE_PASS;
  if (!secret) {
    throw new Error("APP_GATE_PASS is not set");
  }
  return secret;
}

type TokenPayload = {
  v: 1;
  iat: number; // issued at (sec)
  exp: number; // expiry (sec)
};

export function createToken(maxAgeSec = GATE_MAX_AGE_SEC) {
  const now = Math.floor(Date.now() / 1000);
  const payload: TokenPayload = { v: 1, iat: now, exp: now + maxAgeSec };
  const json = JSON.stringify(payload);
  const b64 = base64urlEncode(Buffer.from(json));
  const sig = sign(b64, getGateSecret());
  return `${b64}.${sig}`;
}

export function verifyToken(token?: string | null): boolean {
  if (!token) return false;
  const [b64, sig] = token.split(".");
  if (!b64 || !sig) return false;
  const expected = sign(b64, getGateSecret());
  if (!timingSafeEqual(sig, expected)) return false;
  try {
    const json = Buffer.from(base64urlDecode(b64)).toString("utf8");
    const payload = JSON.parse(json) as TokenPayload;
    if (payload.v !== 1) return false;
    const now = Math.floor(Date.now() / 1000);
    if (now > payload.exp) return false;
    return true;
  } catch {
    return false;
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
