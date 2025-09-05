// app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/db";
import { getQueue } from "@/lib/queues";

// Nodeランタイム（service_roleでDB操作するサーバー専用）
export const runtime = "nodejs";

type Body = { phone?: string };

// 電話番号を数字と+のみの表記へ正規化
function normalizePhone(input: string) {
  return input.trim().replace(/[^\d+]/g, "");
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const rawPhone = String(body.phone ?? "").trim();
    if (!rawPhone) {
      return NextResponse.json(
        { ok: false, error: "phone required" },
        { status: 400 }
      );
    }

    const phone = normalizePhone(rawPhone);

    // 既存チェック（既存なら1クエリで返す）
    const { data: existing, error: findErr } = await supabase
      .from("Users")
      .select("phone_number,balance")
      .eq("phone_number", phone)
      .maybeSingle();

    if (findErr) {
      return NextResponse.json(
        { ok: false, error: findErr.message },
        { status: 500 }
      );
    }

    if (existing) {
      return NextResponse.json(
        {
          ok: true,
          phone,
          balance: Number(existing.balance ?? 0),
          created: false,
          exists: true,
        },
        { status: 200 }
      );
    }

    // 同一電話番号の同時登録を直列化（他の電話番号は並列可）
    const queue = getQueue(`register:${phone}`, 1, 200);
    try {
      const resp = await queue.add(async () => {
        const { error: upsertErr } = await supabase
          .from("Users")
          .upsert(
            { phone_number: phone },
            { onConflict: "phone_number", ignoreDuplicates: true }
          );
        if (upsertErr) throw new Error(upsertErr.message);
        return NextResponse.json(
          { ok: true, phone, balance: 0, created: true },
          { status: 200 }
        );
      });
      return resp;
    } catch (qe: any) {
      if (qe?.code === "QUEUE_LIMIT") {
        return NextResponse.json(
          { ok: false, error: "Processing" },
          {
            status: 429,
            headers: { "x-wait-reason": "Processing, please wait..." },
          }
        );
      }
      return NextResponse.json(
        { ok: false, error: qe?.message ?? "failed during queue" },
        { status: 500 }
      );
    }
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message ?? "unknown error" },
      { status: 500 }
    );
  }
}
