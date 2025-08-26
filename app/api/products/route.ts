import { NextResponse } from "next/server"
import { getProducts, addProduct, updateProduct } from "@/lib/sheets"

export async function GET() {
  try {
    const products = await getProducts()
    return NextResponse.json(products)
  } catch (error) {
    console.error("Error fetching products:", error)
    return NextResponse.json({ error: "Failed to fetch products" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const { name, price } = await request.json()
    await addProduct(name, price)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error adding product:", error)
    return NextResponse.json({ error: "Failed to add product" }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const { product_id, name, price } = await request.json()
    await updateProduct(product_id, name, price)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating product:", error)
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 })
  }
}
