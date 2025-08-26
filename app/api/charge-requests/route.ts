import { TAB, appendRow } from "@/lib/sheets";
import { ChargeRequestSchema } from "@/lib/validators";
import { json, nowISO } from "@/lib/utils";
import { notifyAdmins, isPushReady } from "@/lib/push";
export const dynamic = "force-dynamic";

const uid = () => crypto.randomUUID?.() || Math.random().toString(36).slice(2);

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const parsed = ChargeRequestSchema.safeParse(body);
  if (!parsed.success) return json({ error: parsed.error.format() }, 400);
  const { phone, amount } = parsed.data;

  const id = uid();
  await appendRow(TAB.CHARGE_REQ, [id, phone, amount, "false", nowISO(), ""]);
  if (isPushReady()) {
    await notifyAdmins("Charge Request", `phone: ${phone}, amount: ${amount}`);
  }
  return json({ ok: true, id });
}
