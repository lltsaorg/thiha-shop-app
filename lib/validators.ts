// /lib/validators.ts
import { z } from "zod";

export const PhoneSchema = z.string().trim().min(3);

const ItemSchema = z
  .object({
    product_id: z.string().min(1),
    qty: z.number().int().positive().optional(), // 旧UI互換
    quantity: z.number().int().positive().optional(), // 新スキーマ名
    price: z.number().nonnegative().optional(), // 旧: 受け取るだけ（保存はしない）
    total: z.number().nonnegative().optional(), // 旧UI互換
    total_amount: z.number().nonnegative().optional(), // 新スキーマ名
  })
  .refine((o) => (o.qty ?? o.quantity) != null, {
    message: "qty or quantity is required",
  })
  .refine((o) => (o.total ?? o.total_amount) != null, {
    message: "total or total_amount is required",
  });

export const PurchaseSchema = z.object({
  phone: PhoneSchema,
  items: z.array(ItemSchema).min(1),
  note: z.string().max(200).optional(), // 無視されます（互換のため残すだけ）
});

export const ChargeRequestSchema = z.object({
  phone: PhoneSchema,
  amount: z.number().int().positive(),
});
