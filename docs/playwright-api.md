## Playwright API（開発用）

Vite から独立した Capture Gateway に、要素スクリーンショットを返すエンドポイントを実装しています。Gateway はリクエストごとに Worker を起動し、Worker が Playwright を実行します。

- エンドポイント: `POST /api/screenshot`
- レスポンス: `image/png`（最初に一致した要素のスクリーンショット）

### 入力パラメータ

#### 必須

| フィールド | 型       | 説明                                        |
| ---------- | -------- | ------------------------------------------- |
| `url`      | `string` | 取得対象ページの URL（`http(s)://` が必須） |

#### オプション

| フィールド    | 型                                     | 説明                                                                                     |
| ------------- | -------------------------------------- | ---------------------------------------------------------------------------------------- |
| `selector`    | `string`                               | 取得対象の CSS セレクタ。空文字や空白のみの場合は `body` として扱われます                |
| `userAgent`   | `string`                               | Playwright コンテキストの `userAgent` を上書き                                           |
| `viewport`    | `{ width: number; height: number }`    | ビューポートの幅・高さ（1〜10000 の範囲に切り詰め）                                      |
| `waitFor`     | `string`                               | `page.waitForSelector` に渡す CSS セレクタ                                               |
| `args`        | `string[]`                             | `chromium.launch({ args })` に渡す起動オプション                                         |
| `colorScheme` | `'light' \| 'dark' \| 'no-preference'` | メディア特性 `prefers-color-scheme` をエミュレート                                       |
| `timeout`     | `number`                               | Playwright の操作タイムアウト（ミリ秒）。既定は 15,000ms（フォームからは送信されません） |

### 実装構成

Capture 機能は UI、HTTP Gateway、Worker、キャプチャフローを分離しています。

| 役割               | 型                | 説明                                                            |
| ------------------ | ----------------- | --------------------------------------------------------------- |
| キャプチャ関数     | `createCapturer`  | `capture-core` の Playwright 非依存なキャプチャフロー           |
| Playwright 依存    | `chromium`        | Worker だけが `playwright` を読み込み、要求ごとにブラウザを起動 |
| リクエストハンドラ | `capture-gateway` | HTTP 入力検証、Worker 起動、キャンセル伝播を担当                |
| Gateway            | `capture-gateway` | HTTP 入力検証、Worker 起動、静的 UI 配信を担当                  |

リクエストのバリデーションは `packages/protocol/` の zod スキーマをクライアントと Gateway で共有しています。キャプチャ時のカスタマイズは、`capture-core` の生成時に `CaptureProfile` を注入して行います。

### 注意事項

- タイムアウト（`timeout`）が未指定の場合は 15,000ms を使用します。正の数値を指定すると上書きできます（UI フォームからは送信されないため、API を直接呼ぶ場合のみ利用できます）。
- 依存関係はレポジトリに含まれているため、`pnpm install` を実行してから `pnpm run playwright:install` でブラウザを取得してください。
- `waitFor` が空の場合でも、キャプチャ処理は `selector`（未指定時は `body`）を `page.waitForSelector` してから撮影します。
- 起動オプションはネットワーク／セキュリティ動作に影響するため、ローカル開発環境での利用に限定してください。
- フォーム下部の「共有リンクをコピー」から URL クエリ `pw` に Base64 でシリアライズしたリンクを生成できます。リンクを開くと設定が復元され、その後 `pw` は自動的に削除されます（機微情報は入力しないでください）。
- `pnpm run start` は Gateway が `dist/` と API を同一オリジンで配信します。開発時は Vite が Gateway へ `/api` を proxy します。

### カスタマイズ（Hooks）

共通の前処理・後処理を追加したい場合は、`capture-core` の `createCapturer` に `CaptureProfile` を注入します。

- `prepareBrowser(launchOptions, payload)`：`chromium.launch` に渡すオプションを変更したいときに利用します。
- `preparePage(page, payload, timeout)`：ページ表示前後の任意処理（ログイン、追加ナビゲーションなど）を差し込めます。
- `beforeCapture(page, payload, timeout)`：スクリーンショット直前に DOM を整える処理を追加できます。
- `afterCapture(page, payload, buffer)`：生成された PNG バッファを加工・差し替えできます。`Buffer` を返すと置き換え、`void` なら元のバッファをそのまま返します。

グローバルな可変フックは使用しません。プロファイルは Worker 作成時に固定されるため、テストや将来の複数プロファイルに対応できます。

### リクエスト例

```sh
curl -X POST http://localhost:5173/api/screenshot \
  -H "content-type: application/json" \
  -d '{"url":"https://example.com","selector":"h1"}' \
  --output el.png
```

```sh
curl -X POST http://localhost:5173/api/screenshot \
  -H "content-type: application/json" \
  -d '{
        "url":"https://example.com",
        "selector":"#main",
        "viewport":{"width":1280,"height":720},
        "args":["--host-resolver-rules=MAP * 127.0.0.1"],
        "colorScheme":"dark",
        "timeout":20000
      }' \
  --output el-dark.png
```

### 実装ファイル

- `packages/capture-gateway/src/server.mjs`
- `packages/capture-worker/src/worker.mjs`
- `packages/capture-core/src/capture.mjs`
- `packages/protocol/src/screenshot.js`
