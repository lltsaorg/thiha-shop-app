import { ReactNode } from "react";

export const runtime = "nodejs";

export default function AdminLayout({ children }: { children: ReactNode }) {
  // Note: Protection is handled in (protected)/layout.tsx so that /admin/login remains accessible
  return <>{children}</>;
}
