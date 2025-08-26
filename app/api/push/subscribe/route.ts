import { TAB, appendRow } from "@/lib/sheets";
import { json } from "@/lib/utils";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { adminId, subscription } = await req.json().catch(() => ({}));
  if (!adminId || !subscription) return json({ error: "invalid payload" }, 400);
  await appendRow(TAB.SUBS, [adminId, JSON.stringify(subscription)]);
  return json({ ok: true });
}
