// /lib/fetcher.ts
export const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((r) => r.json());
