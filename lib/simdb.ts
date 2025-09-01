// lib/simdb.ts
// In-memory store for test-only simulated registrations (no DB I/O).

const phones = new Set<string>();

export function simReset() {
  phones.clear();
}

export function simRegister(phone: string): { created: boolean; exists: boolean } {
  if (phones.has(phone)) return { created: false, exists: true };
  phones.add(phone);
  return { created: true, exists: false };
}

export function simCount(inList: string[]): number {
  let c = 0;
  for (const p of inList) if (phones.has(p)) c++;
  return c;
}

export function simExists(phone: string): boolean {
  return phones.has(phone);
}

