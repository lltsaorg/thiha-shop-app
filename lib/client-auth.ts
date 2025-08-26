// /lib/client-auth.ts
const PHONE_KEY = "thiha_phone";

/** 保存済みの電話番号を取得（未保存なら null） */
export function getSavedPhone(): string | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(PHONE_KEY);
  return v && v.trim() ? v.trim() : null;
}

/** 電話番号を保存（ログイン/登録成功時に使用） */
export function setSavedPhone(phone: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PHONE_KEY, String(phone).trim());
}

/** 保存をクリア（必要時） */
export function clearSavedPhone() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(PHONE_KEY);
}

/** 画面側で「必須」を強制したい時に使うヘルパ */
export function requireSavedPhone(): string {
  const p = getSavedPhone();
  if (!p)
    throw new Error(
      "電話番号が未設定です（最初の画面でログイン/新規登録してください）"
    );
  return p;
}
