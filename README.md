# 無人販売システム

Google Sheetsをデータベースとして使用する無人販売システムです。商品購入、残高管理、チャージリクエスト機能を提供します。

## 機能

- **商品購入**: 複数商品の選択・購入機能
- **残高管理**: リアルタイム残高表示・チャージ機能
- **管理者機能**: チャージリクエスト承認、商品管理、売上分析
- **Google Sheets連携**: データの永続化

## 必要な環境

- Node.js 18以上
- Google Cloud Platform アカウント
- Google Sheets

## セットアップ手順

### 1. プロジェクトのクローン・インストール

\`\`\`bash
git clone <repository-url>
cd unmanned-sales-system
npm install
\`\`\`

### 2. Google Sheets APIの設定

#### 2.1 Google Cloud Consoleでの設定

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成または既存のプロジェクトを選択
3. APIとサービス > ライブラリ から「Google Sheets API」を有効化
4. 認証情報 > 認証情報を作成 > APIキー を選択
5. 作成されたAPIキーをコピー（後で使用）

#### 2.2 APIキーの制限設定（推奨）

1. 作成したAPIキーをクリック
2. アプリケーションの制限 > HTTPリファラー を選択
3. 許可するリファラーを追加:
   - `http://localhost:3000/*`
   - `https://yourdomain.com/*` (本番環境のドメイン)
4. API の制限 > キーを制限 を選択
5. Google Sheets API のみを選択

### 3. Google Sheetsの準備

#### 3.1 スプレッドシートの作成

1. [Google Sheets](https://sheets.google.com/) で新しいスプレッドシートを作成
2. スプレッドシートのURLから `SHEET_ID` を取得
   - URL例: `https://docs.google.com/spreadsheets/d/SHEET_ID/edit`
3. スプレッドシートを「リンクを知っている全員が閲覧可能」に設定
   - 右上の「共有」ボタン > 「リンクを知っている全員」> 「閲覧者」

#### 3.2 シートの作成

以下の5つのシートを作成し、それぞれに指定されたヘッダー行を追加してください：

**Products シート:**
\`\`\`
product_id | name | price
1 | コーヒー | 150
2 | お茶 | 120
3 | ジュース | 180
\`\`\`

**Balances シート:**
\`\`\`
phone | balance
08012345678 | 1000
09087654321 | 500
\`\`\`

**Transactions シート:**
\`\`\`
timestamp | type | phone | product_id | qty | price | total | note
\`\`\`

**ChargeRequests シート:**
\`\`\`
id | phone | amount | approved | requested_at | approved_at
\`\`\`

**AdminSubscriptions シート:**
\`\`\`
adminId | subscription
admin1 | active
\`\`\`

### 4. 環境変数の設定

プロジェクトルートに `.env.local` ファイルを作成:

\`\`\`env
SHEET_ID=your_google_sheets_id_here
GOOGLE_SHEETS_API_KEY=your_google_sheets_api_key_here
\`\`\`

### 5. 開発サーバーの起動

\`\`\`bash
npm run dev
\`\`\`

ブラウザで `http://localhost:3000` にアクセス

## 使用方法

### 一般ユーザー

1. **商品購入**:
   - メイン画面で商品をプルダウンから選択
   - 「+」ボタンで複数商品を追加可能
   - 「購入する」ボタンで購入完了
   - 購入証明画面を管理者に見せてからOKボタンを押す

2. **残高チャージ**:
   - 「残高をチャージする」ボタンをクリック
   - 金額を入力して「チャージリクエスト送信」
   - 証明画面を管理者に見せて現金を渡す
   - 管理者の承認後、残高が自動更新

### 管理者

管理者画面には直接URL（`/admin`）でアクセス:

1. **チャージリクエスト管理**:
   - 承認待ちリクエストを確認
   - 「承認」ボタンでチャージを承認
   - 処理済みタブで履歴確認

2. **商品管理**:
   - 商品の追加・編集・削除
   - 商品名での検索機能
   - 表形式での一覧表示

3. **売上分析**:
   - 外部分析ツール（Looker Studio等）への遷移

## API エンドポイント

- `GET /api/products` - 商品一覧取得
- `GET /api/balance?phone=xxx` - 残高取得
- `POST /api/purchase` - 商品購入
- `GET /api/charge-requests` - チャージリクエスト一覧
- `POST /api/charge-requests` - チャージリクエスト作成
- `PUT /api/charge-requests` - チャージリクエスト承認

## トラブルシューティング

### よくある問題

1. **Google Sheets APIエラー**:
   - APIキーが正しく設定されているか確認
   - Google Sheets APIが有効化されているか確認
   - スプレッドシートの共有設定を確認

2. **データが表示されない**:
   - SHEET_IDが正しいか確認
   - シート名が正確か確認（大文字小文字も含む）
   - ヘッダー行が正しく設定されているか確認

3. **残高が更新されない**:
   - ブラウザのキャッシュをクリア
   - 開発者ツールでネットワークエラーを確認

### ログの確認

開発者ツールのコンソールでエラーメッセージを確認してください。

## 本番環境へのデプロイ

### Vercelでのデプロイ

1. Vercelアカウントでプロジェクトをインポート
2. 環境変数を設定:
   - `SHEET_ID`
   - `GOOGLE_SHEETS_API_KEY`
3. デプロイ実行

### その他のプラットフォーム

Next.jsをサポートする任意のプラットフォームでデプロイ可能です。環境変数の設定を忘れずに行ってください。

## 技術スタック

- **フロントエンド**: Next.js 14, React, TypeScript
- **スタイリング**: Tailwind CSS, shadcn/ui
- **データベース**: Google Sheets API
- **デプロイ**: Vercel推奨

## ライセンス

MIT License
