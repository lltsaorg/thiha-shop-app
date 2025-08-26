import { TAB, getAllRows, getHeaderMap } from "@/lib/sheets";
import { json } from "@/lib/utils";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const approvedParam = new URL(req.url).searchParams.get("approved");
  const filter =
    approvedParam == null ? null : String(approvedParam) === "true";

  const h = await getHeaderMap(TAB.CHARGE_REQ);
  const idx = {
    id: h.get("id")!,
    phone: h.get("phone")!,
    amount: h.get("amount")!,
    approved: h.get("approved")!,
    requested_at: h.get("requested_at")!,
    approved_at: h.get("approved_at")!,
  };
  const rows = await getAllRows(TAB.CHARGE_REQ);
  const items = rows
    .filter((r) =>
      filter === null ? true : (r[idx.approved] ?? "false") === String(filter)
    )
    .map((r) => ({
      id: r[idx.id],
      phone: r[idx.phone],
      amount: Number(r[idx.amount] ?? 0),
      approved: (r[idx.approved] ?? "false") === "true",
      requested_at: r[idx.requested_at] ?? "",
      approved_at: r[idx.approved_at] ?? "",
    }));
  return json({ items });
}
