// /lib/db.ts
import { createClient } from '@supabase/supabase-js';
import { cached, delCache } from './cache';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Missing Supabase env vars');
}

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  {
    // Next.js の fetch パッチによる内部キャッシュ影響を避けるため、
    // Supabase 経由の全リクエストで cache: 'no-store' を強制。
    // 型の互換性を広く保つため any 指定。
    global: {
      fetch: (input: any, init?: any) => {
        const opts = init ? { ...init } : {};
        return fetch(input, { ...opts, cache: 'no-store' });
      },
    },
  }
);

export const BAL_TTL = Number(process.env.BALANCE_CACHE_TTL_MS ?? 2000);
export const TOTAL_BAL_TTL = Number(process.env.TOTAL_BALANCE_CACHE_TTL_MS ?? 2000);

export async function findUserByPhone(phone: string) {
  const { data, error } = await supabase
    .from('Users')
    .select('id,phone_number,balance,last_charge_date')
    .eq('phone_number', phone)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

// Lighter variant when only the user id is needed
export async function findUserIdByPhone(
  phone: string
): Promise<string | number | null> {
  const { data, error } = await supabase
    .from('Users')
    .select('id')
    .eq('phone_number', phone)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.id as any) ?? null;
}

export async function getBalanceFast(phone: string) {
  // TTL <= 0 の場合はキャッシュを完全にバイパスし、常にDB直読
  if (BAL_TTL <= 0) {
    const user = await findUserByPhone(phone);
    if (!user) return { exists: false, balance: 0, last_charge_date: '' } as const;
    return {
      exists: true,
      balance: Number(user.balance ?? 0),
      last_charge_date: user.last_charge_date ?? '',
    } as const;
  }

  return cached<{
    exists: boolean;
    balance: number;
    last_charge_date: string;
  }>(`bal:${phone}`, BAL_TTL, async () => {
    const user = await findUserByPhone(phone);
    if (!user) return { exists: false, balance: 0, last_charge_date: '' };
    return {
      exists: true,
      balance: Number(user.balance ?? 0),
      last_charge_date: user.last_charge_date ?? '',
    };
  });
}

export function invalidateBalanceCache(phone: string) {
  delCache(`bal:${phone}`);
  delCache("users:total_balance");
}

export async function getTotalUserBalanceFast(): Promise<number> {
  // TTL <= 0 の場合はキャッシュを完全にバイパスし、常にDB直読
  if (TOTAL_BAL_TTL <= 0) return await getTotalUserBalance();
  return cached<number>("users:total_balance", TOTAL_BAL_TTL, getTotalUserBalance);
}

function isFetchFailedError(error: unknown) {
  return (
    error instanceof TypeError &&
    typeof error.message === 'string' &&
    error.message.includes('fetch failed')
  );
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function getTotalUserBalance(): Promise<number> {
  const pageSize = 200;
  let offset = 0;
  let total = 0;
  for (;;) {
    let data: any[] | null = null;
    let error: Error | null = null;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const result = await supabase
          .from("Users")
          .select("balance")
          .range(offset, offset + pageSize - 1);
        data = result.data;
        error = result.error;
        break;
      } catch (e) {
        if (!isFetchFailedError(e) || attempt === 2) throw e;
        await sleep(200 * (attempt + 1));
      }
    }

    if (error) throw new Error(error.message);
    const rows = data ?? [];
    for (const row of rows as any[]) total += Number(row?.balance ?? 0);
    if (rows.length < pageSize) break;
    offset += pageSize;
  }
  return total;
}

