// app/api/test/register-sim/reset/route.ts
import { NextResponse } from 'next/server';
import { simReset } from '@/lib/simdb';

export const runtime = 'nodejs';

function enabled() {
  return process.env.ENABLE_TEST_SIM === '1';
}

export async function POST() {
  if (!enabled()) return NextResponse.json({ ok: false }, { status: 404 });
  simReset();
  return NextResponse.json({ ok: true });
}

