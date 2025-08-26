// /lib/auth-gate.ts
// どこからでも「最初画面モーダル」を開ける小さなヘルパ
export type AuthGateMode = "home" | "login" | "register";

export function openAuthGate(message?: string, mode: AuthGateMode = "home") {
  if (typeof window === "undefined") return;
  const evt = new CustomEvent("thiha:auth:open", {
    detail: { message, mode } as any,
  });
  window.dispatchEvent(evt);
}
