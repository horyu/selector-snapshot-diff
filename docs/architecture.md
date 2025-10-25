## アーキテクチャ補足（Selector Snapshot Diff）

このドキュメントは README の内容を前提に、実装上の補足メモをまとめたものです。まずは README で概要とワークフローを把握したあと、詳細を確認したい箇所のみ参照してください。

---

### セクション分割の背景

- `App.svelte` は UI のみを扱う調停役とし、実データ処理は `src/domain/**` 配下に分割しています。フォーム・履歴・スクリーンショットのドメインロジックは `src/domain/app/formController.ts` / `historyController.ts` / `screenshotController.ts` を通じて委譲され、Rune の `$state` / `$derived` / `$effect` は画面状態の反映に専念します。
- Playwright 関連のフォーム値は `createFormController` が `src/domain/playwright/config.ts`・`src/domain/playwright/formState.ts` を束ねて扱い、`createSnapshotPersistAction`（`src/actions/persistSnapshot.ts`）で永続化します。UI 側はフォーム操作イベントのみ伝える構成です。
- IndexedDB 操作は `src/domain/history/historyDb.ts` ラッパー → `src/domain/history/history.ts` の二段構えで扱い、`createHistoryController` が `historyStore` とプレビュー生成をまとめて管理します。
- UI コンポーネントは `src/components/` に平坦配置しており、基礎 UI（`FormField.svelte`）も同階層で共有しています。
- すべての Svelte コンポーネントには `<svelte:options runes />` を付与し、`svelte.config.js` の `compilerOptions.runes = true` とあわせて Rune モードをプロジェクト全体に適用しています（明示を残すのはチームの可読性のため）。

---

### 永続化メモ

- 履歴エントリは Blob 本体とメタ情報（サイズ・ラベル・取得時刻・ソース・Playwright フォームスナップショット）を IndexedDB の単一オブジェクトストアにまとめて保存しています。
- プレビュー生成は `src/domain/history/historyPreviews.ts` で `URL.createObjectURL` を使い、コンポーネントの `$effect.root` 副作用で revoke を管理します。
- `localStorage` 側はフォーム入力と差分ビューア設定を個別キーで管理（フォームは `domdiffer.app.v1` に JSON で集約）。タイムアウト値はフェッチ中断 (`AbortController`) 用で、API には送信しません。
- Rune 化後も `createFormController` 内で `persistForm` アクションを保持し、`$state` の変更は `createSnapshotPersistAction` を経由して `localStorage` に同期されます。

---

### 差分ビューア内部メモ

- Pixelmatch は `diffMask` オプションを使い、マスク画像生成とトリプティック出力の双方に流用しています。
- 表示モードごとに CSS ブレンドを切り替え（`mix-blend-mode: difference` など）つつ、スワイプは `clip-path` とハンドルで制御。
- ズーム・パンは CSS transform で行い、内部状態は `$state` で管理しつつ `localStorage` に反映してモーダル再訪時に復元。

---

### Playwright API の補足

- 開発サーバー専用（Vite の `configureServer` フック経由）で、ビルド成果物ではエンドポイントが存在しません。
- `vite build` / `vite preview` モードでは API が無効になるため、クライアント側 (`import.meta.env.DEV` 判定) で警告を表示して処理を中断します。
- 要求中にクライアントが離脱した場合でも Playwright のブラウザを確実にクローズするよう、`shouldAbort` フラグを共有しています。
- リクエストボディは `parsePayload` で厳密に検証し、JSON 以外・型不一致は 400 を返却。タイムアウトは 15,000ms を既定とし、正の数値のみ受け付けます。
- Rune 対応以降は `plugins/playwrightApi/types.ts` に型を集約し、`createScreenshotCapturer` + `createScreenshotRequestHandler` を介して依存注入できる構成に変更しました。
- Playwright フォームの設定は「共有リンクをコピー」操作時に URL クエリ `pw`（Base64 エンコードされた JSON）として生成されます。リンクを開くとフォームへ展開したのち `pw` は URL から削除され、通常操作では URL を変更しません。
