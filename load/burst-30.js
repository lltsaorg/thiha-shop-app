#!/usr/bin/env node
// load/burst-30.js
// Fire N concurrent registration requests to the app endpoint.
// Usage examples:
//   node load/burst-30.js --count 30 --same
//   node load/burst-30.js --count 30 --prefix 099991 --base http://localhost:3000

const DEFAULT_BASE = process.env.BASE_URL || 'http://localhost:3000';
const DEFAULT_COUNT = Number(process.env.COUNT || 30);
const SAME = process.env.SAME === '1' || process.argv.includes('--same');

function readArg(flag, fallback) {
  const i = process.argv.indexOf(flag);
  if (i >= 0 && i + 1 < process.argv.length) return process.argv[i + 1];
  return fallback;
}

const COUNT = Number(readArg('--count', DEFAULT_COUNT));
const BASE = readArg('--base', DEFAULT_BASE);
const SIM = process.env.SIM === '1' || process.argv.includes('--sim');
const PREFIX = readArg('--prefix', '090000'); // used for unique numbers

function randDigits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function genPhone(i, fixed) {
  if (fixed) return fixed;
  // Ensure 09... and <= 11 digits
  // PREFIX plus index padded; fallback random
  const idx = String(i).padStart(3, '0');
  const suffix = randDigits(Math.max(0, 11 - (PREFIX.length + idx.length)));
  return (PREFIX + idx + suffix).slice(0, 11).replace(/\D/g, '');
}

async function main() {
  const path = SIM ? '/api/test/register-sim' : '/api/auth/register';
  const url = `${BASE.replace(/\/$/, '')}${path}`;
  const fixed = SAME ? `09${randDigits(9)}` : null;
  const phones = Array.from({ length: COUNT }, (_, i) => genPhone(i, fixed));
  console.log(`POST ${url}`);
  console.log(`count=${COUNT} same=${!!fixed} base=${BASE} sim=${SIM}`);

  const startedAt = Date.now();
  const results = await Promise.allSettled(
    phones.map(async (phone) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      let body = null;
      try { body = await res.json(); } catch { /* ignore */ }
      return { status: res.status, body, phone };
    })
  );
  const ms = Date.now() - startedAt;

  const summary = {
    ok: 0,
    s429: 0,
    s5xx: 0,
    other: 0,
    createdTrue: 0,
    createdFalse: 0,
    existsTrue: 0,
    errors: 0,
  };
  for (const r of results) {
    if (r.status !== 'fulfilled') {
      summary.errors++;
      continue;
    }
    const { status, body } = r.value;
    if (status >= 200 && status < 300) summary.ok++;
    else if (status === 429) summary.s429++;
    else if (status >= 500) summary.s5xx++;
    else summary.other++;
    if (body && typeof body === 'object') {
      if (body.created === true) summary.createdTrue++;
      if (body.created === false) summary.createdFalse++;
      if (body.exists === true) summary.existsTrue++;
    }
  }

  console.log('--- Summary ---');
  console.log({ duration_ms: ms, ...summary });

  // Print non-2xx samples if any
  const bad = results
    .filter((r) => r.status === 'fulfilled' && (r.value.status < 200 || r.value.status >= 300))
    .slice(0, 5)
    .map((r) => r.value);
  if (bad.length) {
    console.log('Sample non-2xx responses (up to 5):');
    for (const b of bad) {
      console.log(b.status, b.phone, b.body);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
