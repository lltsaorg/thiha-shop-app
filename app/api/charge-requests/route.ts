import { NextResponse } from "next/server"
import { getChargeRequests, addChargeRequest, approveChargeRequest, getBalance } from "@/lib/sheets"

export async function GET() {
  try {
    const requests = await getChargeRequests()

    // Add current balance for each phone number
    const requestsWithBalance = await Promise.all(
      requests.map(async (request) => {
        const balance = await getBalance(request.phone)
        return { ...request, currentBalance: balance }
      }),
    )

    return NextResponse.json(requestsWithBalance)
  } catch (error) {
    console.error("Error fetching charge requests:", error)
    return NextResponse.json({ error: "Failed to fetch charge requests" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { phone, amount } = await request.json()
    const id = await addChargeRequest(phone, amount)
    return NextResponse.json({ success: true, id })
  } catch (error) {
    console.error("Error creating charge request:", error)
    return NextResponse.json({ error: "Failed to create charge request" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { id } = await request.json()
    await approveChargeRequest(id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error approving charge request:", error)
    return NextResponse.json({ error: "Failed to approve charge request" }, { status: 500 })
  }
}
