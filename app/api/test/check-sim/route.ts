// app/api/test/check-sim/route.ts
import { NextResponse } from 'next/server';
import { simExists } from '@/lib/simdb';

export const runtime = 'nodejs';

function enabled() {
  return process.env.ENABLE_TEST_SIM === '1';
}

export async function GET(req: Request) {
  if (!enabled()) return NextResponse.json({ ok: false }, { status: 404 });
  const url = new URL(req.url);
  const phone = String(url.searchParams.get('phone') || '').trim().replace(/[^\d+]/g, '');
  if (!phone) return NextResponse.json({ ok: false, error: 'phone required' }, { status: 400 });
  const exists = simExists(phone);
  return NextResponse.json({ ok: true, exists, balance: 0 });
}

