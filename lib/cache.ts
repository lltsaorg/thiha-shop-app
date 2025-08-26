// /lib/cache.ts

/** 単純なメモリキャッシュ + 重複リクエスト抑止（in-flight 統合） */

type Entry<T> = { expiry: number; value: T };

const store = new Map<string, Entry<any>>();
const inflight = new Map<string, Promise<any>>();

/** 期限チェック付き get */
export function getCache<T>(key: string): T | undefined {
  const e = store.get(key);
  if (!e) return undefined;
  if (e.expiry < Date.now()) {
    store.delete(key);
    return undefined;
  }
  return e.value as T;
}

/** TTL(ms) 指定の set */
export function setCache<T>(key: string, value: T, ttlMs: number) {
  store.set(key, { value, expiry: Date.now() + ttlMs });
}

/** delete */
export function delCache(key: string) {
  store.delete(key);
}

/**
 * 同じキーへの並行アクセスを1回にまとめつつ、成功時に TTL でキャッシュ。
 * 使い方: cached('key', 2000, async () => await fetch(...))
 */
export async function cached<T>(
  key: string,
  ttlMs: number,
  supplier: () => Promise<T>
): Promise<T> {
  const hit = getCache<T>(key);
  if (hit !== undefined) return hit;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const p = (async () => {
    try {
      const val = await supplier();
      setCache(key, val, ttlMs);
      return val;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}
