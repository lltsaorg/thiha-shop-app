import { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getGateCookieName, verifyToken } from "@/lib/gate-auth";

export const runtime = "nodejs";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const c = cookies();
  const token = c.get(getGateCookieName())?.value;
  const ok = verifyToken(token);
  if (!ok) redirect(`/admin/login?next=${encodeURIComponent("/admin")}`);
  return <>{children}</>;
}
