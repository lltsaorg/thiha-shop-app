#!/usr/bin/env node
// load/register.test.js
// Validates registration under burst conditions against the DB (Supabase).
// Scenarios:
// 1) 30 unique numbers -> 30 rows should exist afterward
// 2) 30 same number -> exactly 1 row should exist afterward

const { createClient } = require('@supabase/supabase-js');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const COUNT = Number(process.env.COUNT || 30);
const SIM = process.env.SIM === '1' || process.argv.includes('--sim');

let supabase = null;
let SUPABASE_URL = null;
let SUPABASE_KEY = null;
if (!SIM) {
  SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!SUPABASE_URL || !/^https?:\/\//.test(SUPABASE_URL)) {
    console.error('Missing or invalid SUPABASE_URL');
    process.exit(1);
  }
  if (!SUPABASE_KEY) {
    console.error('Missing Supabase key');
    process.exit(1);
  }
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
}

function randDigits(n) {
  let s = '';
  for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
  return s;
}

function genUniquePhones(prefix, count) {
  return Array.from({ length: count }, (_, i) => {
    const idx = String(i).padStart(3, '0');
    const suffix = randDigits(Math.max(0, 11 - (prefix.length + idx.length)));
    return (prefix + idx + suffix).slice(0, 11);
  });
}

async function simReset() {
  const url = `${BASE.replace(/\/$/, '')}/api/test/register-sim/reset`;
  await fetch(url, { method: 'POST' });
}

async function simCount(phones) {
  const q = encodeURIComponent(phones.join(','));
  const url = `${BASE.replace(/\/$/, '')}/api/test/register-sim?phones=${q}`;
  const res = await fetch(url);
  const j = await res.json();
  return j.count || 0;
}

async function burstRegister(phones) {
  const path = SIM ? '/api/test/register-sim' : '/api/auth/register';
  const url = `${BASE.replace(/\/$/, '')}${path}`;
  const results = await Promise.allSettled(
    phones.map(async (phone) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      let body = null;
      try { body = await res.json(); } catch {}
      return { status: res.status, body, phone };
    })
  );
  return results;
}

async function countUsersByPhones(phones) {
  if (SIM) return simCount(phones);
  // Supabase limits IN size; chunk if needed (but 30 is small)
  const { data, error } = await supabase
    .from('Users')
    .select('phone_number')
    .in('phone_number', phones);
  if (error) throw new Error(error.message);
  const set = new Set(data.map((r) => r.phone_number));
  return set.size;
}

async function scenarioUnique() {
  const prefix = '09099';
  if (SIM) await simReset();
  const phones = genUniquePhones(prefix, COUNT);
  console.log(`Scenario A: ${COUNT} unique phones`);
  const res = await burstRegister(phones);
  const failures = res.filter((r) => r.status === 'fulfilled' && r.value.status >= 300);
  if (failures.length) {
    console.log('Non-2xx samples:', failures.slice(0, 5).map((f) => ({ status: f.value.status, body: f.value.body })));
  }
  const rows = await countUsersByPhones(phones);
  const ok = rows === COUNT;
  console.log(`DB rows found = ${rows} / expected ${COUNT} -> ${ok ? 'OK' : 'NG'}`);
  return ok;
}

async function scenarioSame() {
  const phone = `09${randDigits(9)}`;
  if (SIM) await simReset();
  console.log('Scenario B: 30 same phone');
  const phones = Array.from({ length: COUNT }, () => phone);
  const res = await burstRegister(phones);
  const failures = res.filter((r) => r.status === 'fulfilled' && r.value.status >= 300);
  if (failures.length) {
    console.log('Non-2xx samples:', failures.slice(0, 5).map((f) => ({ status: f.value.status, body: f.value.body })));
  }
  const rows = await countUsersByPhones([phone]);
  const ok = rows === 1;
  console.log(`DB rows found = ${rows} / expected 1 -> ${ok ? 'OK' : 'NG'}`);
  return ok;
}

async function main() {
  const a = await scenarioUnique();
  const b = await scenarioSame();
  if (!(a && b)) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
