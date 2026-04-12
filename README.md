# 厚生労働省モニタリング

厚労省・PMDAのRSSフィードを定期取得し、医療機器・薬事規制に関連する新着情報をメールで通知するスクリプトです。

## セットアップ

### 1. 依存パッケージのインストール

```bash
cd mhlw-monitor
npm install
```

### 2. config.json の設定

`config.json` を開き、メール設定を入力してください：

```json
"email": {
  "from": "あなたのGmailアドレス@gmail.com",
  "to": "送信先@example.com",
  "smtp": {
    "user": "あなたのGmailアドレス@gmail.com",
    "pass": "Gmailアプリパスワード（16文字）"
  }
}
```

#### Gmail アプリパスワードの取得方法
1. Googleアカウント → セキュリティ → 2段階認証を有効化
2. セキュリティ → アプリパスワード → 「その他」で生成
3. 生成された16文字のパスワードを `pass` に設定

> ⚠️ `config.json` に認証情報が含まれるため、Gitリポジトリには含めないでください。

### 3. 動作確認

```bash
# メール設定テスト
node main.js --test-email

# 初回実行（全件をAI判定）
node main.js --force

# 通常実行
node main.js
```

---

## Claude Code でのスケジュール設定

Claude Code の「スケジュール」機能で以下のように設定してください：

| 項目 | 値 |
|------|-----|
| コマンド | `node /path/to/mhlw-monitor/main.js` |
| スケジュール | `0 9 * * *`（毎朝9時） |
| 作業ディレクトリ | `/path/to/mhlw-monitor` |

---

## ファイル構成

```
mhlw-monitor/
├── main.js          # エントリポイント
├── config.json      # 設定ファイル（要編集）
├── package.json
├── src/
│   ├── fetcher.js   # RSS取得・パース
│   ├── filter.js    # Claude AIによる関連性判定・要約
│   ├── state.js     # 既読状態の永続化
│   └── emailer.js   # HTMLメール生成・送信
└── data/
    └── seen.json    # 自動生成される既読IDリスト
```

---

## 関連性プロフィールのカスタマイズ

`config.json` の `relevanceProfile` を編集することで、関心領域を調整できます：

```json
"relevanceProfile": {
  "keywords": ["医療機器", "歯科", ...],
  "description": "判断基準の自然言語説明..."
}
```

- `keywords`: 高速プレフィルタ用キーワード（漏れ防止のため広めに設定）
- `description`: Claudeへ渡す関心領域の説明文（精度向上のため具体的に記述）

---

## 環境変数での認証情報管理（推奨）

`config.json` に直書きせず、環境変数で管理することも可能です：

```bash
export SMTP_USER="your@gmail.com"
export SMTP_PASS="your-app-password"
```

`src/emailer.js` の該当箇所を以下のように変更：

```js
auth: {
  user: process.env.SMTP_USER || smtp.user,
  pass: process.env.SMTP_PASS || smtp.pass,
}
```

---

## 使用API・ライブラリ

| 用途 | ライブラリ |
|------|-----------|
| RSS パース | fast-xml-parser |
| メール送信 | nodemailer |
| AI 関連性判定 | @anthropic-ai/sdk (claude-opus-4-5) |
