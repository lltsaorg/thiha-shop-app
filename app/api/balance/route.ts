import { NextResponse } from "next/server"
import { getBalance, updateBalance } from "@/lib/sheets"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const phone = searchParams.get("phone")

    if (!phone) {
      return NextResponse.json({ error: "Phone number required" }, { status: 400 })
    }

    const balance = await getBalance(phone)
    return NextResponse.json({ balance })
  } catch (error) {
    console.error("Error fetching balance:", error)
    return NextResponse.json({ error: "Failed to fetch balance" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { phone, balance } = await request.json()
    await updateBalance(phone, balance)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating balance:", error)
    return NextResponse.json({ error: "Failed to update balance" }, { status: 500 })
  }
}
