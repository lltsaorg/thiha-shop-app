// components/ui/BalanceGuard.tsx
"use client";

import * as React from "react";
import useSWR from "swr";
import LoginRegisterGate from "@/components/ui/login-register-gate";
import { apiFetch } from "@/lib/api";

const fetcher = async (u: string) => {
  const res = await apiFetch(u, { lockUI: false });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error || res.statusText);
  return json;
};

export type BalanceGuardProps = { children?: React.ReactNode };

export default function BalanceGuard({ children }: BalanceGuardProps) {
  const [authed, setAuthed] = React.useState<boolean | null>(null);

  // Check cookie session
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/session", { cache: "no-store" });
        if (!cancelled) setAuthed(r.ok);
      } catch {
        if (!cancelled) setAuthed(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { data } = useSWR(
    authed ? `/api/balance` : null,
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
  if (data && data.exists === false) return <LoginRegisterGate onAuthed={handleAuthed} />;
  return <>{children}</>;
}
