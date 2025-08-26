"use client"

import { ShoppingCart, Wallet, CreditCard, Plus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState, useEffect } from "react"
import Link from "next/link"

export default function PurchasePage() {
  const [products, setProducts] = useState<Array<{ id: number; name: string; price: number }>>([])
  const [selectedProducts, setSelectedProducts] = useState<Array<{ id: string; productId: number | null }>>([
    { id: "1", productId: null },
  ])
  const [balance, setBalance] = useState(0)
  const [showReceipt, setShowReceipt] = useState(false)
  const [purchaseData, setPurchaseData] = useState<any>(null)
  const [userPhone] = useState("08012345678") // In real app, this would come from auth

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch("/api/products")
        const data = await response.json()
        setProducts(data.map((p: any) => ({ id: p.product_id, name: p.name, price: p.price })))
      } catch (error) {
        console.error("Failed to load products:", error)
      }
    }
    loadProducts()
  }, [])

  useEffect(() => {
    const loadBalance = async () => {
      try {
        const response = await fetch(`/api/balance?phone=${userPhone}`)
        const data = await response.json()
        setBalance(data.balance)
      } catch (error) {
        console.error("Failed to load balance:", error)
      }
    }

    loadBalance()
    const interval = setInterval(loadBalance, 2000)
    return () => clearInterval(interval)
  }, [userPhone])

  const addProductDropdown = () => {
    const newId = Date.now().toString()
    setSelectedProducts((prev) => [...prev, { id: newId, productId: null }])
  }

  const removeProductDropdown = (id: string) => {
    if (selectedProducts.length > 1) {
      setSelectedProducts((prev) => prev.filter((item) => item.id !== id))
    }
  }

  const updateSelectedProduct = (id: string, productId: number | null) => {
    setSelectedProducts((prev) => prev.map((item) => (item.id === id ? { ...item, productId } : item)))
  }

  const getTotalPrice = () => {
    return selectedProducts.reduce((total, item) => {
      if (item.productId) {
        const product = products.find((p) => p.id === item.productId)
        return total + (product ? product.price : 0)
      }
      return total
    }, 0)
  }

  const getSelectedProductsList = () => {
    const productCounts: { [key: number]: number } = {}

    selectedProducts.forEach((item) => {
      if (item.productId) {
        productCounts[item.productId] = (productCounts[item.productId] || 0) + 1
      }
    })

    return Object.entries(productCounts)
      .map(([productId, quantity]) => {
        const product = products.find((p) => p.id === Number(productId))
        return { ...product, quantity }
      })
      .filter((item) => item.quantity > 0)
  }

  const handlePurchase = async () => {
    const selectedList = getSelectedProductsList()
    const totalPrice = getTotalPrice()

    if (selectedList.length === 0) {
      alert("商品を選択してください")
      return
    }

    if (balance < totalPrice) {
      alert("残高が不足しています")
      return
    }

    try {
      const response = await fetch("/api/purchase", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          phone: userPhone,
          products: selectedList,
          totalPrice,
        }),
      })

      const result = await response.json()
      if (result.success) {
        setBalance(result.newBalance)
        setPurchaseData({
          products: selectedList,
          totalPrice,
          timestamp: new Date().toLocaleString("ja-JP"),
          remainingBalance: result.newBalance,
        })
        setShowReceipt(true)
        setSelectedProducts([{ id: "1", productId: null }])
      } else {
        alert("購入に失敗しました")
      }
    } catch (error) {
      console.error("Purchase failed:", error)
      alert("購入に失敗しました")
    }
  }

  if (showReceipt && purchaseData) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-md mx-auto">
          <Card className="border-2 border-primary">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mb-4">
                <ShoppingCart className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-xl font-black">購入完了</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted p-4 rounded-lg space-y-3">
                {purchaseData.products.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between">
                    <span className="text-sm">
                      {item.name} × {item.quantity}
                    </span>
                    <span className="font-semibold">¥{(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
                <div className="border-t pt-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">合計金額</span>
                    <span className="font-bold text-lg">¥{purchaseData.totalPrice.toLocaleString()}</span>
                  </div>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">購入日時</span>
                  <span className="text-sm">{purchaseData.timestamp}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="text-sm text-muted-foreground">残高</span>
                  <span className="font-semibold text-primary">¥{purchaseData.remainingBalance.toLocaleString()}</span>
                </div>
              </div>

              <div className="text-center text-sm text-muted-foreground px-2">
                管理者に証明画面を見せてください、その後OKボタンを押してください
              </div>

              <Button
                onClick={() => {
                  setShowReceipt(false)
                }}
                className="w-full h-12"
              >
                OK
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-xl font-black text-center">商品購入</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-6">
        <div className="space-y-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Wallet className="w-5 h-5 text-primary mr-2" />
                  <span className="font-semibold">現在の残高</span>
                </div>
                <Badge variant="secondary" className="text-lg font-bold px-3 py-1 bg-primary/10 text-primary">
                  ¥{balance.toLocaleString()}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <div className="mb-8">
            <Link href="/charge">
              <Button
                variant="outline"
                className="w-full h-12 bg-transparent border-primary text-primary hover:bg-primary/10"
              >
                <CreditCard className="w-5 h-5 mr-2" />
                残高をチャージする
              </Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">商品を選択</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {selectedProducts.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="flex-1">
                      <Select
                        value={item.productId?.toString() || ""}
                        onValueChange={(value) => updateSelectedProduct(item.id, value ? Number(value) : null)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="商品を選択してください" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((product) => (
                            <SelectItem key={product.id} value={product.id.toString()}>
                              {product.name} - ¥{product.price}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedProducts.length > 1 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => removeProductDropdown(item.id)}
                        className="h-10 w-10 p-0 text-destructive hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}

                <Button
                  variant="outline"
                  onClick={addProductDropdown}
                  className="w-full h-10 border-dashed border-primary text-primary hover:bg-primary/10 bg-transparent"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  商品を追加
                </Button>
              </div>

              {getTotalPrice() > 0 && (
                <div className="bg-primary/10 p-3 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">合計金額</span>
                    <span className="text-lg font-bold text-primary">¥{getTotalPrice().toLocaleString()}</span>
                  </div>
                </div>
              )}

              <Button
                onClick={handlePurchase}
                disabled={getTotalPrice() === 0}
                className="w-full h-12 text-lg font-semibold"
              >
                購入する
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
