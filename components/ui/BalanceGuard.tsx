// components/ui/BalanceGuard.tsx
"use client";

import * as React from "react";
import useSWR from "swr";
import LoginRegisterGate from "@/components/ui/login-register-gate";
import { apiFetch } from "@/lib/api";
import { getSavedPhoneIfFresh, setSavedPhone } from "@/lib/client-auth";

declare global {
  interface Window {
    __THIHA_FALLBACK_MAX_AGE__?: number;
  }
}

const getFallbackAgeSec = () => {
  if (typeof window !== "undefined") {
    const v = window.__THIHA_FALLBACK_MAX_AGE__;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.floor(v);
  }
  return 60 * 60 * 24 * 7; // default 7 days
};

const fetcher = async (u: string) => {
  const res = await apiFetch(u, { lockUI: false, cache: "no-store" });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || res.statusText);
  return json;
};

export type BalanceGuardProps = { children?: React.ReactNode };

export default function BalanceGuard({ children }: BalanceGuardProps) {
  const [authed, setAuthed] = React.useState<boolean | null>(null);
  const [phone, setPhone] = React.useState<string | null>(null);

  // Check cookie session and capture phone; fallback to saved phone if fresh
  React.useEffect(() => {
    let cancelled = false;
    // Optimistic: if local fallback exists, assume authed immediately to avoid flicker
    try {
      const saved0 = getSavedPhoneIfFresh(getFallbackAgeSec());
      if (saved0) {
        setAuthed(true);
        setPhone(saved0);
      }
    } catch {}
    (async () => {
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        if (cancelled) return;
        if (r.ok) {
          const j = await r.json().catch(() => ({}));
          setAuthed(true);
          if (typeof j?.phone === "string" && j.phone) {
            setPhone(j.phone);
            // Proactively keep fallback fresh to avoid gate flicker on next navigation
            try { setSavedPhone(j.phone); } catch {}
          }
        } else {
          // Fallback only if within allowed age
          const saved = getSavedPhoneIfFresh(getFallbackAgeSec());
          if (saved) {
            setAuthed(true);
            setPhone(saved);
          } else {
            setAuthed(false);
            setPhone(null);
          }
        }
      } catch {
        if (!cancelled) {
          const saved = getSavedPhoneIfFresh(getFallbackAgeSec());
          if (saved) {
            setAuthed(true);
            setPhone(saved);
          } else {
            setAuthed(false);
          }
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { data } = useSWR(
    authed && phone ? `/api/balance?phone=${encodeURIComponent(phone)}` : null,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
      dedupingInterval: 60_000,
      shouldRetryOnError: false,
    }
  );

  const handleAuthed = React.useCallback((_p: string, _b: number) => {
    // After login, recheck session and trigger SWR
    setAuthed(true);
  }, []);

  if (authed === null) return null; // or a lightweight spinner
  if (!authed) return <LoginRegisterGate onAuthed={handleAuthed} />;
  return <>{children}</>;
}
