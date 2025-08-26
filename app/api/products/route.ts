import { TAB, getAllRows, getHeaderMap } from "@/lib/sheets";
import { json } from "@/lib/utils";
export const dynamic = "force-dynamic";

export async function GET() {
  const h = await getHeaderMap(TAB.PRODUCTS);
  const idx = {
    product_id: h.get("product_id")!,
    name: h.get("name")!,
    price: h.get("price")!,
  };
  const rows = await getAllRows(TAB.PRODUCTS);
  const items = rows.map((r) => ({
    product_id: r[idx.product_id],
    name: r[idx.name],
    price: Number(r[idx.price] ?? 0),
  }));
  return json({ items });
}
