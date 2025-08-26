# Thihaショップ（Vercel + Google Sheets / 社内向けシンプル版）

## Database (Google Sheets)

各シートの 1 行目はヘッダ。列名は**厳密一致**。

- **Products** — `product_id, name, price`
- **Users** — `phone, balance, last_charge_date`
- **Transactions** — `timestamp, phone, product_id, quantity, total_amount`
- **ChargeRequests** — `id, phone, amount, approved, requested_at, approved_at`
  - `approved`: `"true"` / `"false"`
- **AdminSubscriptions** — `adminId, subscription`（Push 購読 JSON 文字列）

> 例: `Products` に `p1, Water, 100` を 1 行入れておくと確認が楽です。

## 事前準備

1. **サービスアカウント**を作成（JSON キー発行）
2. **Google Sheets API** を有効化
3. 対象シートをサービスアカウントの **client_email** に**編集者**で共有（リンク共有は OFF）

## 依存 / 環境変数

## ローカル起動手順（Local Development Quickstart）

> 前提: Node.js 18+ / npm（または pnpm）、Google Sheets 側はこのREADME冒頭のスキーマ通りに作成済み

### 1) リポジトリ取得 & 依存インストール
```bash
git clone <このリポジトリURL>
cd <リポジトリ名>
npm i
# まだ入れていなければ
npm i googleapis zod web-push
npm run dev
