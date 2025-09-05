// components/ui/login-register-gate.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { AuthGateMode } from "@/lib/auth-gate";
import { apiFetch } from "@/lib/api";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { setSavedPhone } from "@/lib/client-auth";

type Props = {
  onAuthed: (phone: string, balance: number) => void;
};

const PHONE_KEY = "thiha_phone";
const MIGRATED_KEY = "thiha_phone_migrated"; // one-time migration flag

/** 電話番号: 国内形式のみ（09で始まり数字のみ・全体8〜11桁） */
export function isValidPhone(input: string): boolean {
  const digits = input.trim().replace(/\D/g, ""); // 数字以外を除去
  return /^09\d{6,9}$/.test(digits); // 09 + 数字6〜9桁 = 8〜11桁
}

/** 入力値を保存用に正規化（国内形式のみ受理）→ 09... の数字列を返す */
export function normalizeToDomestic(input: string): string | null {
  const digits = input.trim().replace(/\D/g, "");
  return /^09\d{6,9}$/.test(digits) ? digits : null;
}

export default function LoginRegisterGate({ onAuthed }: Props) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthGateMode>("home");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const tried = useRef(false);
  const [alreadyExistsOpen, setAlreadyExistsOpen] = useState(false);
  const [confirmRegisterOpen, setConfirmRegisterOpen] = useState(false);
  const registeringRef = useRef(false);
  const loggingInRef = useRef(false);

  const onAuthedRef = useRef(onAuthed);
  useEffect(() => {
    onAuthedRef.current = onAuthed;
  }, [onAuthed]);

  // ★ StrictMode でも 1 回しか走らないようにガード
  const didBoot = useRef(false);
  useEffect(() => {
    if (didBoot.current) return;
    didBoot.current = true;

    const saved =
      typeof window !== "undefined" ? localStorage.getItem(PHONE_KEY) : null;
    const migrated =
      typeof window !== "undefined" ? localStorage.getItem(MIGRATED_KEY) : null;

    if (saved && !migrated) {
      // ★ 一度だけ Cookie へ移行（DBアクセスなし）し、localStorage をクリア
      fetch("/api/auth/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: saved }),
      })
        .catch(() => {})
        .finally(() => {
          try {
            localStorage.setItem(MIGRATED_KEY, "1");
            // Keep a lightweight fallback for internal use
            setSavedPhone(saved);
          } catch {}
          setOpen(false);
          onAuthedRef.current(saved, 0);
          new BroadcastChannel("thiha-shop").postMessage({
            type: "LOGIN_SUCCESS",
            phone: saved,
          });
        });
      // 残高は各画面の SWR が取得・共有するためここでは追加リクエストしない
    } else {
      // 既に移行済み、または保存なし → モーダル表示（Cookie 無効ならここでログインを促す）
      setOpen(true);
    }
  }, []);

  useEffect(() => {
    function onOpen(e: Event) {
      const ce = e as CustomEvent<{ message?: string; mode?: AuthGateMode }>;
      setFlash(ce.detail?.message ?? null);
      setMode(ce.detail?.mode ?? "home");
      setError(null);
      setPhone("");
      setOpen(true);
    }
    if (typeof window !== "undefined") {
      window.addEventListener("thiha:auth:open", onOpen as EventListener);
      return () =>
        window.removeEventListener("thiha:auth:open", onOpen as EventListener);
    }
  }, []);

  async function autoLogin(p: string) {
    try {
      const r = await apiFetch(
        `/api/auth/check?phone=${encodeURIComponent(p)}`,
        {
          cache: "no-store",
          lockUI: false,
        }
      );
      const j = await r.json();
      if (r.ok && j.exists) {
        setOpen(false);
        onAuthed(p, Number(j.balance ?? 0));
        return;
      }
    } catch {}
    setOpen(true);
  }

  async function doLogin() {
    setError(null);

    const normalized = normalizeToDomestic(phone);
    if (!normalized) {
      setError("Enter a valid phone. Start with 09. 8–11 digits.");
      return;
    }

    if (loggingInRef.current) return;
    loggingInRef.current = true;
    setLoading(true);
    try {
      // ★ 送信も保存も正規化した 09... を使用
      const r = await apiFetch(
        `/api/auth/check?phone=${encodeURIComponent(normalized)}`,
        {
          cache: "no-store",
          lockUI: false,
        }
      );
      const j = await r.json();
      if (r.ok && j.exists) {
        // ★ Cookie セッションを発行（localStorage へは保存しない）
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: normalized }),
        });
        try {
          localStorage.setItem(MIGRATED_KEY, "1");
          // Persist a relaxed fallback for internal usage
          setSavedPhone(normalized);
        } catch {}
        setOpen(false);
        onAuthed(normalized, Number(j.balance ?? 0));
        new BroadcastChannel("thiha-shop").postMessage({
          type: "LOGIN_SUCCESS",
          phone: normalized,
        });
      } else {
        setError("Phone not registered. Please register.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
      loggingInRef.current = false;
    }
  }

  async function doRegister() {
    setError(null);

    const normalized = normalizeToDomestic(phone);
    if (!normalized) {
      setError("Enter a valid phone. Start with 09. 8–11 digits.");
      return;
    }

    if (registeringRef.current) return;
    registeringRef.current = true;
    setLoading(true);
    try {
      // 事前チェック：既に登録済みならモーダル表示して終了
      try {
        const r0 = await apiFetch(
          `/api/auth/check?phone=${encodeURIComponent(normalized)}`,
          { cache: "no-store", lockUI: false }
        );
        const j0 = await r0.json().catch(() => ({}));
        if (r0.ok && j0?.exists) {
          setAlreadyExistsOpen(true);
          return;
        }
      } catch {}

      const r = await apiFetch(`/api/auth/register`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone: normalized }),
        waitMessage: "Processing, please wait...",
        retryOn429: true,
        max429Retries: 6,
      });
      const j: any = await r.json().catch(() => ({}));

      // ★ 成功判定を新旧レスポンス両対応に
      const isOk =
        r.ok && (j?.ok === true || typeof j?.created !== "undefined");

      // 既存番号だった場合はモーダルで案内し、Welcomeへ戻す
      if (isOk && (j?.created === false || j?.exists === true)) {
        setAlreadyExistsOpen(true);
        return;
      }

      if (isOk) {
        await fetch("/api/auth/session", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone: normalized }),
        });
        try {
          localStorage.setItem(MIGRATED_KEY, "1");
          // Persist a relaxed fallback for internal usage
          setSavedPhone(normalized);
        } catch {}
        setOpen(false);
        onAuthed(normalized, Number(j?.balance ?? 0));
        new BroadcastChannel("thiha-shop").postMessage({
          type: "LOGIN_SUCCESS",
          phone: normalized,
        });
      } else {
        setError(j?.error || j?.message || "Fail to register");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
      registeringRef.current = false;
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 p-4">
      <Card className="w-full max-w-md bg-white">
        <CardHeader>
          <CardTitle className="text-lg">
            {mode === "home"
              ? "Welcome, use phone number"
              : mode === "login"
              ? "Log In"
              : "Register"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 既存登録モーダル */}
          <ConfirmModal
            open={alreadyExistsOpen}
            onOpenChange={setAlreadyExistsOpen}
            title="Already Registered"
            description="This number is already registered, please log in."
            confirmLabel="OK"
            cancelLabel=""
            onConfirm={() => {
              setAlreadyExistsOpen(false);
              setMode("home");
              setError(null);
              setPhone("");
            }}
          />

          {flash && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {flash}
            </div>
          )}

          {mode === "home" && (
            <div className="grid grid-cols-2 gap-3">
              <Button className="h-11" onClick={() => setMode("login")}>
                Log In
              </Button>
              <Button
                variant="outline"
                className="h-11"
                onClick={() => setMode("register")}
              >
                Register
              </Button>
            </div>
          )}

          {mode !== "home" && (
            <>
              <div className="space-y-1">
                <label htmlFor="phone" className="text-sm font-medium">
                  Phone Number
                </label>
                <input
                  id="phone"
                  required
                  inputMode="numeric"
                  // ブラウザの軽いチェックも併用（JS 側の isValidPhone が主）
                  pattern="^09\d{6,9}$"
                  title="Start with 09. Use 8–11 digits (e.g., 09000000000)"
                  placeholder="e.g. 09000000000"
                  className="w-full rounded-md border px-3 py-2 outline-none focus:border-gray-400"
                  aria-describedby="phoneHelp"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading}
                />
                <p
                  id="phoneHelp"
                  className="text-xs text-muted-foreground mt-1"
                >
                  Start with 09. Use 8–11 digits. Example: 09000000000
                </p>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                <Button
                  className="h-11 flex-1"
                  disabled={loading || !isValidPhone(phone)}
                  onClick={
                    mode === "login"
                      ? doLogin
                      : () => setConfirmRegisterOpen(true)
                  }
                >
                  {loading
                    ? "Loading..."
                    : mode === "login"
                    ? "Log In"
                    : "Register"}
                </Button>
                <Button
                  className="h-11 flex-1"
                  variant="outline"
                  onClick={() => {
                    setMode("home");
                    setError(null); // flashは残してもOK。消したいなら setFlash(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Register 実行前の確認モーダル（電話番号の最終確認） */}
      <ConfirmModal
        open={confirmRegisterOpen}
        onOpenChange={setConfirmRegisterOpen}
        title="Double check your phone number"
        description="Is this correct?"
        confirmLabel="OK"
        cancelLabel="Cancel"
        confirmDisabled={loading}
        onConfirm={() => {
          setConfirmRegisterOpen(false);
          void doRegister();
        }}
      >
        <div className="rounded-md border p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Phone</span>
            <span className="font-semibold">{phone}</span>
          </div>
        </div>
      </ConfirmModal>
    </div>
  );
}
