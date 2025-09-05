// /lib/client-auth.ts
const PHONE_KEY = "thiha_phone";
const PHONE_AT_KEY = "thiha_phone_at"; // epoch millis of last set

/** 保存済みの電話番号を取得（未保存なら null） */
export function getSavedPhone(): string | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(PHONE_KEY);
  return v && v.trim() ? v.trim() : null;
}

/** 電話番号を保存（ログイン/登録成功時に使用） */
export function setSavedPhone(phone: string) {
  if (typeof window === "undefined") return;
  const p = String(phone).trim();
  window.localStorage.setItem(PHONE_KEY, p);
  try {
    window.localStorage.setItem(PHONE_AT_KEY, String(Date.now()));
  } catch {}
}

/** 保存をクリア（必要時） */
export function clearSavedPhone() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PHONE_KEY);
  try {
    window.localStorage.removeItem(PHONE_AT_KEY);
  } catch {}
}

/** 画面側で「必須」を強制したい時に使うヘルパ */
export function requireSavedPhone(): string {
  const p = getSavedPhone();
  if (!p)
    throw new Error("Phone not set. Please log in or register first.");
  return p;
}

/** 保存済み電話番号が一定期間内かチェックして返す（期限切れなら null） */
export function getSavedPhoneIfFresh(maxAgeSec: number): string | null {
  if (typeof window === "undefined") return null;
  const p = window.localStorage.getItem(PHONE_KEY);
  if (!p || !p.trim()) return null;
  const atRaw = window.localStorage.getItem(PHONE_AT_KEY);
  const at = Number(atRaw);
  if (!Number.isFinite(at)) return null;
  const ageMs = Date.now() - at;
  if (ageMs > Math.max(0, maxAgeSec) * 1000) return null;
  return p.trim();
}
