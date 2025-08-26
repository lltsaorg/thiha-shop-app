import { NextResponse } from "next/server"
import { getBalance, updateBalance, addTransaction } from "@/lib/sheets"

export async function POST(request: Request) {
  try {
    const { phone, products, totalPrice } = await request.json()

    // Check balance
    const currentBalance = await getBalance(phone)
    if (currentBalance < totalPrice) {
      return NextResponse.json({ error: "Insufficient balance" }, { status: 400 })
    }

    // Update balance
    const newBalance = currentBalance - totalPrice
    await updateBalance(phone, newBalance)

    // Add transaction records
    for (const product of products) {
      await addTransaction({
        type: "purchase",
        phone,
        product_id: product.id,
        qty: product.quantity,
        price: product.price,
        total: product.price * product.quantity,
        note: `Purchase: ${product.name}`,
      })
    }

    return NextResponse.json({ success: true, newBalance })
  } catch (error) {
    console.error("Error processing purchase:", error)
    return NextResponse.json({ error: "Failed to process purchase" }, { status: 500 })
  }
}
