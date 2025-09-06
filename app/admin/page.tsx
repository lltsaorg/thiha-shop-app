"use client";

import { useSWRConfig } from "swr";
import useSWRImmutable from "swr/immutable";
import { useState, useEffect, useCallback, useRef } from "react";
import { fetcher } from "@/lib/fetcher";
import { apiFetch } from "@/lib/api";
import {
  CreditCard,
  Package,
  BarChart3,
  Check,
  Edit,
  Trash2,
  Plus,
  Search,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatYGNMinute } from "@/lib/utils";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { supabaseBrowser } from "@/lib/supabase-browser";

// Analytics external links from env (client-side)
const ANALYTICS_SPREADSHEET_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_SPREADSHEET_URL ||
  "https://lookerstudio.google.com";
const ANALYTICS_DASHBOARD_URL =
  process.env.NEXT_PUBLIC_ANALYTICS_DASHBOARD_URL ||
  "https://lookerstudio.google.com";

type AdminChargeRequest = {
  id: string;
  phone: string;
  amount: number;
  approved: boolean;
  requested_at?: string;
  approved_at?: string;
  currentBalance?: number;
};

// 数字だけに正規化
const normalizePhone = (p?: string) => (p ?? "").replace(/\D/g, "");

// 現在残高表示は不要になったため削除（以前の BalanceCell を撤去）

export default function AdminPage() {
  const { mutate } = useSWRConfig();

  const [activeTab, setActiveTab] = useState("charge");
  const [notification, setNotification] = useState("");
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [editError, setEditError] = useState("");
  const [newProduct, setNewProduct] = useState({ name: "", price: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [chargePhoneQuery, setChargePhoneQuery] = useState("");
  const [logoutOpen, setLogoutOpen] = useState(false);

  // 商品は immutable
  const {
    data: productsRaw,
    isLoading: loadingProducts,
    mutate: refetchProducts,
  } = useSWRImmutable("/api/products", fetcher);

  // チャージリクエストはページング（「もっと見る」方式）
  const PAGE_SIZE = 50;
  const [crItems, setCrItems] = useState<AdminChargeRequest[]>([]);
  const [crOffset, setCrOffset] = useState(0);
  const [crHasMore, setCrHasMore] = useState(false);
  const [crLoaded, setCrLoaded] = useState(false);
  const [loadingCR, setLoadingCR] = useState(false);
  const [crDirty, setCrDirty] = useState(false);

  const normalizeRequests = (list: any[]): AdminChargeRequest[] =>
    list.map((r: any) => ({
      id: String(r.id ?? r.request_id ?? r.uuid),
      phone: r.phone ?? r.phone_number ?? r.Users?.phone_number,
      amount: Number(r.amount ?? 0),
      approved:
        typeof r.approved === "boolean"
          ? r.approved
          : String(r.approved).toLowerCase() === "true",
      requested_at: r.requested_at ?? r.createdAt ?? r.created_at ?? "",
      approved_at: r.approved_at ?? r.approvedAt ?? "",
      currentBalance: Number(
        r.currentBalance ?? r.balance ?? r.Users?.balance ?? 0
      ),
    }));

  const loadChargeRequests = useCallback(
    async (opts?: { reset?: boolean }) => {
      if (loadingCR) return;
      setLoadingCR(true);
      const nextOffset = opts?.reset ? 0 : crOffset;
      try {
        const res = await apiFetch(
          `/api/charge-requests?status=all&limit=${PAGE_SIZE}&offset=${nextOffset}`,
          { lockUI: false, cache: "no-store" }
        );
        const json = await res.json().catch(() => ({}));
        const raw = Array.isArray(json) ? json : json?.items ?? [];
        const normalized = normalizeRequests(raw);
        setCrItems((prev) =>
          opts?.reset ? normalized : [...prev, ...normalized]
        );
        setCrOffset(nextOffset + normalized.length);
        setCrHasMore(normalized.length >= PAGE_SIZE);
      } catch (e) {
        console.error("Failed to load charge-requests:", e);
      } finally {
        setLoadingCR(false);
        setCrLoaded(true);
      }
    },
    [loadingCR, crOffset, PAGE_SIZE]
  );

  // タブが charge の時に初回ロード（StrictMode でも一度だけ）
  const didInitRef = useRef(false);
  useEffect(() => {
    if (activeTab !== "charge") return;
    if (didInitRef.current) return;
    didInitRef.current = true;
    loadChargeRequests({ reset: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  // フォーカス/可視化時に最新化（常に軽く再取得。無駄な再取得は軽くスロットル）
  const lastFocusSyncRef = useRef<number>(0);
  useEffect(() => {
    const maybeRefresh = () => {
      if (activeTab !== "charge") return;
      if (crDirty) {
        setCrDirty(false);
        loadChargeRequests({ reset: true });
        return;
      }
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastFocusSyncRef.current < 3000) return; // 3秒スロットル
      lastFocusSyncRef.current = now;
      loadChargeRequests({ reset: true });
    };
    window.addEventListener("focus", maybeRefresh);
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => {
      window.removeEventListener("focus", maybeRefresh);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, [activeTab, crDirty, loadChargeRequests]);

  // Minimal Supabase Realtime: ChargeRequests INSERT and approved UPDATE
  useEffect(() => {
    const sb = supabaseBrowser;
    if (!sb) return;

    // subscribe only when Charge tab is active and page is visible
    if (activeTab !== "charge" || document.visibilityState !== "visible")
      return;

    let refreshTimer: number | null = null;
    const scheduleRefresh = () => {
      setCrDirty(true);
      if (refreshTimer != null) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        loadChargeRequests({ reset: true });
        setCrDirty(false);
      }, 300);
    };

    const channel = sb
      .channel("admin-charge-requests")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "ChargeRequests" },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ChargeRequests",
          filter: "approved=eq.true",
        },
        scheduleRefresh
      )
      .subscribe();

    const onVisibility = () => {
      if (document.visibilityState !== "visible") {
        sb.removeChannel(channel);
        if (refreshTimer != null) window.clearTimeout(refreshTimer);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (refreshTimer != null) window.clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", onVisibility);
      sb.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, loadChargeRequests]);

  // フォーカス/可視化時に最新化（変更があった場合のみ）
  useEffect(() => {
    const maybeRefresh = () => {
      if (activeTab !== "charge") return;
      // BroadcastChannel などで変更が検知された場合のみ再取得
      if (crDirty) {
        loadChargeRequests({ reset: true });
        setCrDirty(false);
      }
    };
    window.addEventListener("focus", maybeRefresh);
    document.addEventListener("visibilitychange", maybeRefresh);
    return () => {
      window.removeEventListener("focus", maybeRefresh);
      document.removeEventListener("visibilitychange", maybeRefresh);
    };
  }, [activeTab, crDirty, loadChargeRequests]);

  // products 整形
  const products: any[] = (
    Array.isArray(productsRaw) ? productsRaw : productsRaw?.items ?? []
  ).map((p: any) => ({
    id: p.id ?? p.uuid,
    name: p.name,
    price: Number(p.price ?? 0),
  }));

  // charge-requests 整形済み（ページングで保持）
  const requests: AdminChargeRequest[] = crItems;

  // 承認
  const handleApprove = async (req: AdminChargeRequest) => {
    setIsLoading(true);
    try {
      const response = await apiFetch("/api/charge-requests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: req.id }),
        waitMessage: "Processing, please wait...",
        retryOn429: true,
        max429Retries: 6,
      });
      const result = await response.json();
      if (result.success) {
        // Realtime on ChargeRequests will refresh the list; no manual reload/broadcast
        setNotification("Approved the request.");
        setTimeout(() => setNotification(""), 3000);
      } else {
        setNotification("Approve failed.");
        setTimeout(() => setNotification(""), 3000);
      }
    } catch (error) {
      console.error("Approval failed:", error);
      setNotification("Approve failed.");
      setTimeout(() => setNotification(""), 3000);
    } finally {
      setIsLoading(false);
    }
  };

  // 編集
  const handleEditProduct = async (product: any) => {
    // 価格は文字列入力を許容しているため、送信時に検証・数値化
    const priceText = String(product.price ?? "").trim();
    const priceNum = Number(priceText);
    if (!priceText || !Number.isFinite(priceNum)) {
      setEditError("Enter a price.");
      return;
    }
    try {
      const response = await apiFetch(`/api/products/${product.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: product.name, price: priceNum }),
      });
      const result = await response.json();
      if (result.success) {
        await refetchProducts();
        setEditingProduct(null);
        setEditError("");
        setNotification("Product updated.");
        setTimeout(() => setNotification(""), 3000);
        // 他タブ（購入画面など）へ商品変更を通知（SWR再取得を促す）
        new BroadcastChannel("thiha-shop").postMessage({
          type: "PRODUCTS_CHANGED",
        });
      }
    } catch (error) {
      console.error("Product update failed:", error);
      setNotification("Update failed.");
      setTimeout(() => setNotification(""), 3000);
    }
  };

  // 削除
  const handleDeleteProduct = async (product: {
    id: number;
    name?: string;
  }) => {
    const id = product.id;
    if (!Number.isInteger(id)) {
      setNotification("Delete failed (bad ID).");
      setTimeout(() => setNotification(""), 3000);
      return;
    }
    const ok = window.confirm(`Delete "${product.name ?? id}"?`);
    if (!ok) return;

    try {
      const res = await apiFetch(`/api/products/${id}`, { method: "DELETE" });
      const result = await res.json().catch(() => ({}));
      if (res.ok && result?.success !== false) {
        await refetchProducts();
        setNotification("Product deleted.");
        new BroadcastChannel("thiha-shop").postMessage({
          type: "PRODUCTS_CHANGED",
        });
      } else {
        setNotification(`Delete failed: ${result?.error ?? res.statusText}`);
      }
    } catch (e) {
      console.error("Product delete failed:", e);
      setNotification("Delete failed.");
    } finally {
      setTimeout(() => setNotification(""), 3000);
    }
  };

  // 追加
  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.price) return;
    if (isAdding) return; // ← 二重実行ガード
    setIsAdding(true);
    try {
      const response = await apiFetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newProduct.name,
          price: Number(newProduct.price),
        }),
      });
      const result = await response.json();
      if (result.success) {
        await refetchProducts();
        setNewProduct({ name: "", price: "" });
        setIsAddOpen(false);
        setNotification("Product added.");
        setTimeout(() => setNotification(""), 3000);
        new BroadcastChannel("thiha-shop").postMessage({
          type: "PRODUCTS_CHANGED",
        });
      }
    } catch (error) {
      console.error("Product addition failed:", error);
      setNotification("Add failed.");
      setTimeout(() => setNotification(""), 3000);
    } finally {
      setIsAdding(false); // ← 必ず解除
    }
  };

  const filteredProducts = products.filter((product) =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const pendingRequests = requests.filter((req) => !req.approved);
  const processedRequests = requests.filter((req) => req.approved);

  // 電話番号フィルタ（数字のみで部分一致）
  const phoneQuery = normalizePhone(chargePhoneQuery);
  const matchPhone = (p: string) =>
    !phoneQuery || normalizePhone(p).includes(phoneQuery);
  const visiblePendingRequests = pendingRequests.filter((r) =>
    matchPhone(r.phone)
  );
  const visibleProcessedRequests = processedRequests.filter((r) =>
    matchPhone(r.phone)
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-card border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-xl font-black">Admin Dashboard</h1>
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLogoutOpen(true)}
              >
                Log out
              </Button>
              <ConfirmModal
                open={logoutOpen}
                onOpenChange={setLogoutOpen}
                title="Log out?"
                description="You will go back to login. OK?"
                confirmLabel="OK"
                cancelLabel="Cancel"
                onConfirm={() => {
                  window.location.href = "/api/admin/logout";
                }}
              />
            </>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6">
        {notification && (
          <Alert className="mb-6 border-primary bg-primary/5">
            <AlertDescription className="text-primary">
              {notification}
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Button
            variant={activeTab === "charge" ? "default" : "outline"}
            onClick={() => setActiveTab("charge")}
            className="h-16 flex flex-col gap-1"
          >
            <CreditCard className="w-6 h-6" />
            <span>Top-up</span>
          </Button>
          <Button
            variant={activeTab === "products" ? "default" : "outline"}
            onClick={() => setActiveTab("products")}
            className="h-16 flex flex-col gap-1"
          >
            <Package className="w-6 h-6" />
            <span>Products</span>
          </Button>
          <Button
            variant={activeTab === "analytics" ? "default" : "outline"}
            onClick={() => setActiveTab("analytics")}
            className="h-16 flex flex-col gap-1"
          >
            <BarChart3 className="w-6 h-6" />
            <span>Sales Data</span>
          </Button>
        </div>

        {/* Charge Request Management（このカード内だけ縦スクロール） */}
        {activeTab === "charge" && (
          <Card className="max-h-[75vh] flex flex-col overflow-hidden">
            <CardHeader className="flex items-center justify-between">
              <CardTitle className="text-lg font-black">Requests</CardTitle>
              <div className="flex items-center gap-2">
                {crDirty && (
                  <Badge
                    variant="secondary"
                    className="bg-primary/10 text-primary"
                  >
                    New
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadChargeRequests({ reset: true })}
                  disabled={loadingCR}
                  aria-busy={loadingCR}
                >
                  <RefreshCw
                    className={"w-4 h-4 " + (loadingCR ? "animate-spin" : "")}
                  />
                </Button>
              </div>
            </CardHeader>

            {/* ヘッダーを除いた残りの高さを占有。ここでは overflow は隠す */}
            <CardContent className="flex-1 flex flex-col overflow-hidden min-h-0">
              <Tabs
                defaultValue="pending"
                className="flex-1 flex flex-col w-full min-h-0"
              >
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="pending">
                    Pending ({pendingRequests.length})
                  </TabsTrigger>
                  <TabsTrigger value="processed">Done</TabsTrigger>
                </TabsList>
                {/* 電話番号検索（両タブ共通） */}
                <div className="mt-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                    <Input
                      placeholder="Search phone... (numbers only)"
                      inputMode="numeric"
                      value={chargePhoneQuery}
                      onChange={(e) => setChargePhoneQuery(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* 承認待ち：タブの中で “だけ” スクロール */}
                <TabsContent
                  value="pending"
                  className="flex-1 flex flex-col overflow-hidden mt-6 min-h-0"
                >
                  {visiblePendingRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No pending requests.
                    </div>
                  ) : (
                    <div
                      className="flex-1 overflow-y-auto pr-2"
                      style={{ scrollbarGutter: "stable both-edges" }}
                    >
                      <div className="grid grid-cols-1 gap-4">
                        {visiblePendingRequests.map((request) => (
                          <Card
                            key={request.id}
                            className="border-2 border-primary/20 py-2 gap-2"
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">
                                      {request.phone}
                                    </span>
                                    <span className="text-sm text-muted-foreground font-semibold">
                                      ID: {request.id}
                                    </span>
                                    <Badge
                                      variant="secondary"
                                      className="bg-primary/10 text-primary"
                                    >
                                      Pending
                                    </Badge>
                                  </div>
                                  <div className="text-sm font-semibold text-muted-foreground">
                                    Amount: {request.amount.toLocaleString()}ks
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    <span className="text-sm font-semibold">
                                      {formatYGNMinute(request.requested_at)}
                                    </span>
                                  </div>
                                </div>
                                <Button
                                  onClick={() => handleApprove(request)}
                                  size="sm"
                                  className="h-8"
                                  disabled={isLoading}
                                >
                                  <Check className="w-4 h-4 mr-1" />
                                  Approve
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* もっと見る（承認待ちタブ内） */}
                  {crLoaded && crHasMore && (
                    <div className="mt-4 flex justify-center">
                      <Button
                        onClick={() => loadChargeRequests()}
                        disabled={loadingCR}
                      >
                        Load more
                      </Button>
                    </div>
                  )}
                </TabsContent>

                {/* 処理済み：同じくタブ内スクロール */}
                <TabsContent
                  value="processed"
                  className="flex-1 flex flex-col overflow-hidden mt-6 min-h-0"
                >
                  {visibleProcessedRequests.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No done requests.
                    </div>
                  ) : (
                    <div
                      className="flex-1 overflow-y-auto pr-2"
                      style={{ scrollbarGutter: "stable both-edges" }}
                    >
                      <div className="grid grid-cols-1 gap-4">
                        {visibleProcessedRequests.map((request) => (
                          <Card key={request.id} className="py-2 gap-2">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">
                                      {request.phone}
                                    </span>
                                    <span className="text-sm text-muted-foreground font-semibold">
                                      ID: {request.id}
                                    </span>
                                    {request.approved ? (
                                      <Badge
                                        variant="secondary"
                                        className="bg-green-100 text-green-800"
                                      >
                                        Approved
                                      </Badge>
                                    ) : (
                                      <Badge
                                        variant="secondary"
                                        className="bg-primary/10 text-primary"
                                      >
                                        Pending
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="text-sm text-muted-foreground">
                                    Amount: {request.amount.toLocaleString()}ks
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    Requested:{" "}
                                    {formatYGNMinute(request.requested_at)} |
                                    Approved:
                                    {request.approved
                                      ? formatYGNMinute(request.approved_at)
                                      : "-"}
                                  </div>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* もっと見る（処理済みタブ内） */}
                  {crLoaded && crHasMore && (
                    <div className="mt-4 flex justify-center">
                      <Button
                        onClick={() => loadChargeRequests()}
                        disabled={loadingCR}
                      >
                        もっと見る
                      </Button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}

        {/* Products tab */}
        {activeTab === "products" && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-black">Products</CardTitle>
                <Dialog
                  open={isAddOpen}
                  onOpenChange={(open) => {
                    if (isAdding) return; // 送信中は閉じさせない
                    setIsAddOpen(open);
                  }}
                >
                  <DialogTrigger asChild>
                    <Button
                      size="sm"
                      onClick={() => setIsAddOpen(true)}
                      disabled={isAdding}
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Product
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Product</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Name</Label>
                        <Input
                          id="name"
                          value={newProduct.name}
                          onChange={(e) =>
                            setNewProduct((prev) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                          disabled={isAdding}
                        />
                      </div>
                      <div>
                        <Label htmlFor="price">Price</Label>
                        <Input
                          id="price"
                          type="number"
                          value={newProduct.price}
                          onChange={(e) =>
                            setNewProduct((prev) => ({
                              ...prev,
                              price: e.target.value,
                            }))
                          }
                          disabled={isAdding}
                        />
                      </div>
                      <Button
                        onClick={handleAddProduct}
                        className="w-full"
                        disabled={isAdding}
                        aria-busy={isAdding}
                      >
                        {isAdding ? "Adding..." : "Add"}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search by name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              <div className="max-h-96 overflow-y-auto border rounded-lg">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-background border-b">
                      <tr>
                        <th className="text-left py-3 px-4">Name</th>
                        <th className="text-left py-3 px-4">Price</th>
                        <th className="text-right py-3 px-4">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProducts.map((product) => (
                        <tr
                          key={product.id}
                          className="border-b hover:bg-muted/50"
                        >
                          <td className="py-3 px-4">{product.name}</td>
                          <td className="py-3 px-4">
                            {product.price.toLocaleString()}ks
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex gap-2 justify-end">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setEditError("");
                                  setEditingProduct({
                                    ...product,
                                    // 価格編集時は空文字も許容するため文字列で保持
                                    price: String(product.price),
                                  });
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteProduct(product)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {filteredProducts.length === 0 && searchTerm && (
                <div className="text-center py-8 text-muted-foreground">
                  No products found for "{searchTerm}".
                </div>
              )}

              {/* 単一・制御モーダル：編集 */}
              <Dialog
                open={!!editingProduct}
                onOpenChange={(open) => {
                  if (!open) {
                    setEditingProduct(null);
                    setEditError("");
                  }
                }}
              >
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Product</DialogTitle>
                  </DialogHeader>

                  {editingProduct && (
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="edit-name">Name</Label>
                        <Input
                          id="edit-name"
                          value={editingProduct.name}
                          onChange={(e) =>
                            setEditingProduct((prev: any) => ({
                              ...prev,
                              name: e.target.value,
                            }))
                          }
                        />
                      </div>

                      <div>
                        <Label htmlFor="edit-price">Price</Label>
                        <Input
                          id="edit-price"
                          type="number"
                          value={editingProduct.price}
                          onChange={(e) => {
                            const v = e.target.value;
                            setEditingProduct((prev: any) => ({
                              ...prev,
                              // 空欄入力を許容するため数値変換しない
                              price: v,
                            }));
                            if ((v ?? "").trim() !== "") setEditError("");
                          }}
                        />
                        {editError && (
                          <p className="text-sm text-destructive mt-1">
                            {editError}
                          </p>
                        )}
                      </div>

                      <Button
                        onClick={() => handleEditProduct(editingProduct)}
                        className="w-full"
                      >
                        Update
                      </Button>
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>
        )}

        {activeTab === "analytics" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-black">Sales Data</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="flex flex-col items-center gap-8">
                  <Button asChild size="lg" className="h-12 px-8 text-lg">
                    <a
                      href={ANALYTICS_SPREADSHEET_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Sheet & Dashboard
                    </a>
                  </Button>
                  {/* <Button asChild size="lg" className="h-12 px-8 text-lg">
                    <a
                      href={ANALYTICS_DASHBOARD_URL}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Open Dashboard
                    </a>
                  </Button> */}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
