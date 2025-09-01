// app/api/test/register-sim/route.ts
import { NextResponse } from 'next/server';
import { getQueue } from '@/lib/queues';
import { simRegister, simCount } from '@/lib/simdb';

export const runtime = 'nodejs';

function enabled() {
  return process.env.ENABLE_TEST_SIM === '1';
}

type Body = { phone?: string };

function normalizePhone(input: string) {
  return String(input || '').trim().replace(/[^\d+]/g, '');
}

export async function POST(req: Request) {
  if (!enabled()) return NextResponse.json({ ok: false }, { status: 404 });
  const url = new URL(req.url);
  const delay = Number(url.searchParams.get('delay') || 0);
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const raw = normalizePhone(body.phone || '');
    if (!raw) return NextResponse.json({ ok: false, error: 'phone required' }, { status: 400 });

    const queue = getQueue(`simreg:${raw}`, 1, 200);
    try {
      const resp = await queue.add(async () => {
        if (delay > 0) await new Promise((r) => setTimeout(r, Math.min(5000, delay)));
        const r = simRegister(raw);
        return NextResponse.json(
          { ok: true, phone: raw, balance: 0, created: r.created, exists: r.exists },
          { status: 200 }
        );
      });
      return resp;
    } catch (e: any) {
      if (e?.code === 'QUEUE_LIMIT') {
        return NextResponse.json(
          { ok: false, error: 'Processing' },
          { status: 429, headers: { 'x-wait-reason': 'Processing, please wait...' } }
        );
      }
      return NextResponse.json({ ok: false, error: e?.message || 'queue error' }, { status: 500 });
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown error' }, { status: 500 });
  }
}

// GET /api/test/register-sim?phones=comma,separated
export async function GET(req: Request) {
  if (!enabled()) return NextResponse.json({ ok: false }, { status: 404 });
  const url = new URL(req.url);
  const list = (url.searchParams.get('phones') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const count = simCount(list);
  return NextResponse.json({ ok: true, count, total: list.length });
}

