"use client";

import { endRequest, startRequest, setLoadingMessage } from "./request-tracker";

export type ApiFetchInit = RequestInit & {
  // If true, shows the global blocking overlay during this request.
  // Defaults: true for non-GET; false for GET.
  lockUI?: boolean;
  // Optional message to show while locked.
  waitMessage?: string;
  // If true, automatically retries on 429 with backoff while keeping the overlay.
  retryOn429?: boolean;
  max429Retries?: number;
};

export async function apiFetch(
  input: RequestInfo | URL,
  init: ApiFetchInit = {}
): Promise<Response> {
  const method = (init.method || "GET").toUpperCase();
  const shouldLock = init.lockUI ?? (method !== "GET");
  const waitMessage = init.waitMessage;
  const retryOn429 = init.retryOn429 ?? false;
  const max429 = init.max429Retries ?? 3;

  // Simple in-flight deduplication for idempotent GET requests.
  // Ensures identical concurrent GETs share the same network call and response.
  // Note: Response bodies are one-time readable, so we return clones for deduped callers.
  // This only applies when UI locking is not used (default for GET).
  const inflightMap: Map<string, Promise<Response>> = (globalThis as any).__inflightGetMap__ ||= new Map();
  const keyFrom = (inp: RequestInfo | URL, init: RequestInit | undefined) => {
    try {
      const m = (init?.method || "GET").toUpperCase();
      // Normalize to a string URL for keying
      const urlStr = typeof inp === "string"
        ? inp
        : inp instanceof URL
        ? inp.toString()
        : (inp as any)?.url || String(inp);
      // Include select init options that may affect the response semantics
      const cache = init?.cache ?? "";
      const nextTag = (init as any)?.next?.tags ? JSON.stringify((init as any).next.tags) : "";
      return `${m}|${urlStr}|cache:${cache}|tags:${nextTag}`;
    } catch {
      return `${init?.method || "GET"}|${String(inp)}`;
    }
  };

  const isGet = method === "GET";
  const tryDedup = isGet && shouldLock === false;

  if (tryDedup) {
    const key = keyFrom(input, init);
    const existing = inflightMap.get(key);
    if (existing) return existing.then((r) => r.clone());
    // Create the fetch promise that others can await. We'll manage retries below.
    // We place a placeholder promise that we will replace after building the real one,
    // but keep the same reference for dedup callers.
    let resolveP: (v: Response) => void;
    let rejectP: (e: any) => void;
    const holder = new Promise<Response>((res, rej) => {
      resolveP = res;
      rejectP = rej;
    });
    inflightMap.set(key, holder);
    // We proceed but ensure map cleanup when finished
    const finalize = (resOrErr: Response | Error, ok: boolean) => {
      inflightMap.delete(key);
      if (ok) resolveP(resOrErr as Response);
      else rejectP(resOrErr);
    };

    // We perform the actual logic (with 429 retries) below within the normal flow,
    // but short-circuit return at the end using the holder promise.
    // To reuse existing logic, we'll run the rest of the function in a nested block.
    if (shouldLock) startRequest(waitMessage);
    (async () => {
      try {
        let attempt = 0;
        let lastRes: Response | null = null;
        let delay = 500;
        for (;;) {
          const res = await fetch(input, init);
          lastRes = res;
          if (!(retryOn429 && res.status === 429 && attempt < max429)) {
            finalize(res, true);
            return;
          }
          const hdrMsg = res.headers.get("x-wait-reason");
          if (hdrMsg) setLoadingMessage(hdrMsg);
          else if (waitMessage) setLoadingMessage(waitMessage);
          await new Promise((r) => setTimeout(r, delay));
          attempt += 1;
          delay = Math.min(5000, Math.floor(delay * 1.8));
        }
        // eslint-disable-next-line no-unreachable
        finalize(lastRes as Response, true);
      } catch (e: any) {
        finalize(e, false);
      } finally {
        if (shouldLock) endRequest();
      }
    })();
    return holder.then((r) => r.clone());
  }

  if (shouldLock) startRequest(waitMessage);
  try {
    let attempt = 0;
    let lastRes: Response | null = null;
    let delay = 500;
    for (;;) {
      const res = await fetch(input, init);
      lastRes = res;
      if (!(retryOn429 && res.status === 429 && attempt < max429)) {
        return res;
      }
      // Update message if server provided one
      const hdrMsg = res.headers.get("x-wait-reason");
      if (hdrMsg) setLoadingMessage(hdrMsg);
      else if (waitMessage) setLoadingMessage(waitMessage);
      await new Promise((r) => setTimeout(r, delay));
      attempt += 1;
      delay = Math.min(5000, Math.floor(delay * 1.8));
    }
    // Fallback (shouldn't reach)
    // eslint-disable-next-line no-unreachable
    return lastRes as Response;
  } finally {
    if (shouldLock) endRequest();
  }
}

