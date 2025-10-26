## Playwright API（開発用）

Vite の開発サーバに、要素スクリーンショットを返すエンドポイントを実装しています（Vite プラグイン）。本リファレンスは Rune 対応後の依存注入構成を前提にしています。

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

Playwright API プラグインはシンプルな依存差し替えができるよう、主要な型を `plugins/playwrightApi/types.ts` にまとめています。

| 役割               | 型                               | 説明                                                                                        |
| ------------------ | -------------------------------- | ------------------------------------------------------------------------------------------- |
| キャプチャ関数     | `ScreenshotCapturer`             | スクリーンショット取得ロジック（`createScreenshotCapturer` で生成）。テスト用に差し替え可能 |
| Playwright 依存    | `CaptureDependencies`            | `BrowserLauncher`（`chromium.launch` 等）を引き回すための依存オブジェクト                   |
| リクエストハンドラ | `createScreenshotRequestHandler` | HTTP レイヤを担当。`timeoutMs` や `logger` もオプションで注入                               |
| プラグイン設定     | `PlaywrightApiOptions`           | `routePath` / `capture` / `timeoutMs` / `logger` をまとめた Vite プラグインの設定パラメータ |

`playwrightApi.ts` では上記オプションを受け取り、既定値として `chromium.launch` を利用したキャプチャ関数を使用します。必要に応じてテスト専用のモックやトレースログを差し替える際は、`PlaywrightApiOptions` 経由で `capture` や `logger` を注入してください。

### 注意事項

- タイムアウト（`timeout`）が未指定の場合は 15,000ms を使用します。正の数値を指定すると上書きできます（UI フォームからは送信されないため、API を直接呼ぶ場合のみ利用できます）。
- 依存関係はレポジトリに含まれているため、`pnpm install` を実行してから `pnpm exec playwright install chromium` でブラウザを取得してください。
- `waitFor` が空の場合でも、キャプチャ処理は `selector`（未指定時は `body`）を `page.waitForSelector` してから撮影します。
- 起動オプションはネットワーク／セキュリティ動作に影響するため、ローカル開発環境での利用に限定してください。
- フォーム下部の「共有リンクをコピー」から URL クエリ `pw` に Base64 でシリアライズしたリンクを生成できます。リンクを開くと設定が復元され、その後 `pw` は自動的に削除されます（機微情報は入力しないでください）。
- ランタイムでエンドポイントが読み込まれるのは `pnpm run dev` 実行時だけです。ビルド成果物（`pnpm run build`／`pnpm run preview`）では有効化されません。クライアント側では `import.meta.env.DEV` で無効化ガードを行っています。

### カスタマイズ（Hooks）

共通の前処理・後処理を追加したい場合は `plugins/playwrightApi/hooks.ts` に定義されている `globalCaptureHooks` を直接編集します。

- `prepareBrowser(launchOptions, payload)`：`chromium.launch` に渡すオプションを変更したいときに利用します。
- `preparePage(page, payload, timeout)`：ページ表示前後の任意処理（ログイン、追加ナビゲーションなど）を差し込めます。
- `beforeCapture(page, payload, timeout)`：スクリーンショット直前に DOM を整える処理を追加できます。
- `afterCapture(page, payload, buffer)`：生成された PNG バッファを加工・差し替えできます。`Buffer` を返すと置き換え、`void` なら元のバッファをそのまま返します。

外部からフックを差し込む仕組みは用意していないため、このファイルを修正してグローバルに適用するのが前提です。

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

- `plugins/playwrightApi.ts`
- `plugins/playwrightApi/handler.ts`
- `plugins/playwrightApi/` 配下のユーティリティ（`payload.ts`, `responses.ts`, `errors.ts`, `screenshot.ts`, `body.ts`, `types.ts`）
- `vite.config.ts` にプラグインを登録済み
