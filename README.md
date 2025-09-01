# Thihaショップ（Vercel + Supabase / 社内向けシンプル版）

## Database (Supabase)

Supabase のテーブル構造は以下の通りです。

- **Products** — `id, name, price`
- **Users** — `id, phone_number, balance, last_charge_date`
- **Transactions** — `id, created_at, user_id, product_id, quantity, total_amount`
- **ChargeRequests** — `id, user_id, amount, approved, requested_at, approved_at`
  - `approved`: `true` / `false`
- **AdminSubscriptions** — `adminId, subscription`（Push 購読 JSON 文字列）

## Google Sheets から Supabase への移行手順

1. Google Sheets で使用中の各シートを CSV 形式でエクスポートする。
2. Supabase プロジェクトを作成し、上記スキーマでテーブルを作成する。
3. Supabase の Table Editor から CSV をインポートし、データを移行する。
4. プロジェクトの URL とサービスロールキーを取得し、`.env` に設定する。

```
SUPABASE_URL=<プロジェクトURL>
SUPABASE_SERVICE_ROLE_KEY=<サービスロールキー>
# 任意: キャッシュのTTL (ミリ秒)
BALANCE_CACHE_TTL_MS=2000
```

## 事前準備

1. 上記 `.env` を作成
2. 依存関係をインストール

```bash
npm install
```

## ローカル起動手順

```bash
git clone <このリポジトリURL>
cd <リポジトリ名>
npm install
npm run dev
```

## Web Push について

現在 Web Push はダミー実装になっており、設定しなくてもアプリは動作します。
将来的に Push 通知を有効化する場合は、`/lib/push.ts` の `isPushReady()` を実装し、
VAPID キーなどの必要な設定を行ってください。

## testingブランチでのテスト

なるほど！「コードをコピーする」や余計な文字が混ざらない、すべてMarkdown形式のREADME用ブロックにまとめたいのですね。以下をそのままコピペすれば、完全にMarkdownとして表示されます👇

````markdown
### What I Added

#### DBを触らない擬似登録APIとUI切り替え
- `app/api/test/register-sim/route.ts`: 登録（POST）/件数確認（GET）
- `app/api/test/check-sim/route.ts`: 既存確認（GET）
- `app/api/test/register-sim/reset/route.ts`: メモリ状態リセット（POST）
- `lib/simdb.ts`: メモリのみ（DB非使用）
- `components/ui/login-register-gate.tsx`: 環境変数で SIM / REAL 切替  
  `NEXT_PUBLIC_USE_SIM_AUTH=1` で check/register を SIM API に切替

#### UI自動テスト雛形（Playwright）
- `e2e/register-sim.spec.ts`（DB非使用）
- `e2e/register-real.spec.ts`（DB使用）
- `playwright.config.ts`

#### スクリプト
- `package.json`: `e2e:test:sim`, `e2e:test:real` を追加
- 既存の負荷スクリプトも `--sim` で DB非使用APIへ切り替え可  
  `load/burst-30.js`, `load/register.test.js`

---

### Modes

- **非DBモード（SIM）**: `ENABLE_TEST_SIM=1` と `NEXT_PUBLIC_USE_SIM_AUTH=1` を設定  
- **実DBモード（REAL）**: 上記を未設定（DBへ実際にUpsert）

---

### Run: UI 自動テスト（SIM / DB非使用）

**依存導入（初回のみ）**
```bash
npm i -D @playwright/test
npx playwright install
````

**サーバー起動（PowerShell）**

```powershell
$env:ENABLE_TEST_SIM='1'; $env:NEXT_PUBLIC_USE_SIM_AUTH='1'; npm run dev
```

**別ターミナルでテスト実行**

```bash
npm run e2e:test:sim
```

**期待挙動**

* モーダル表示 → Register → 全画面ローディング
  → 成功でモーダル閉 → `localStorage['thiha_phone']` 保存

---

### Run: UI 自動テスト（REAL / DB使用）

**サーバー再起動（フラグ未設定で）**

```bash
npm run dev
```

**テスト実行**

```bash
npm run e2e:test:real
```

⚠️ 注意: 本番DB（`.env.local` の Supabase）にレコードが作成されます

---

### Run: 手動UI確認（SIM / DB非使用）

**サーバー起動（SIMフラグあり）**

```powershell
$env:ENABLE_TEST_SIM='1'; $env:NEXT_PUBLIC_USE_SIM_AUTH='1'; npm run dev
```

ブラウザでアクセス → モーダル → Register → 電話番号入力 → Register
429時は「Processing, please wait…」が出て自動再試行

---

### Run: API負荷テスト（DB非使用/使用を選択）

**SIM（DB非使用）**

```bash
npm run load:burst -- --sim --count 30        # ユニーク30件
npm run load:burst -- --sim --same --count 30 # 同一番号30回
```

**REAL（DB使用）**

```bash
npm run load:burst -- --count 30
```

**まとめ検証（SIM/REAL切替対応）**

```bash
# SIM
npm run load:test:register -- --sim

# REAL
npm run load:test:register
```

---

### Key Files

* `components/ui/login-register-gate.tsx`（SIM/REAL切替）
* `app/api/test/register-sim/route.ts`
* `app/api/test/check-sim/route.ts`
* `app/api/test/register-sim/reset/route.ts`
* `load/burst-30.js`
* `load/register.test.js`
* `e2e/register-sim.spec.ts`
* `e2e/register-real.spec.ts`