## アーキテクチャ補足（Selector Snapshot Diff）

このドキュメントは README の内容を前提に、実装上の補足メモをまとめたものです。まずは README で概要とワークフローを把握したあと、詳細を確認したい箇所のみ参照してください。

---

### セクション分割の背景

- `App.svelte` はフォーム・スロット・履歴・モーダルの調整役に徹し、実データ処理は `src/domain/**` 配下（diff / history / playwright / slots）へ切り出しています。Rune 化により各セクションは `$state` / `$derived` / `$effect` を利用し、従来のストア購読は廃止済みです。
- Playwright 関連のフォーム値は `src/domain/playwright/config.ts` と `src/domain/playwright/formState.ts` で構造化し、UI から疑似 API 呼び出しまでを緩く結合。フォーム永続化は `createSnapshotPersistAction`（`src/actions/persistSnapshot.ts`）経由で行います。
- IndexedDB 操作は `src/domain/history/historyDb.ts` ラッパー → `src/domain/history/history.ts` の二段構えで扱い、ストア購読は `src/domain/history/historyStore.ts` から提供しています。
- UI コンポーネントは `src/components/` に平坦配置しており、基礎 UI（`FormField.svelte`）も同階層で共有しています。
- すべての Svelte コンポーネントには `<svelte:options runes />` を付与し、`svelte.config.js` の `compilerOptions.runes = true` とあわせて Rune モードをプロジェクト全体に適用しています（明示を残すのはチームの可読性のため）。

---

### 永続化メモ

- 履歴エントリは Blob 本体とメタ情報（サイズ・ラベル・取得時刻・ソース・Playwright フォームスナップショット）を IndexedDB の単一オブジェクトストアにまとめて保存しています。
- プレビュー生成は `src/domain/history/historyPreviews.ts` で `URL.createObjectURL` を使い、コンポーネントの `$effect.root` 副作用で revoke を管理します。
- `localStorage` 側はフォーム入力と差分ビューア設定を個別キーで管理（フォームは `domdiffer.app.v1` に JSON で集約）。タイムアウト値はフェッチ中断 (`AbortController`) 用で、API には送信しません。
- Rune 化後も `persistForm` アクションは `$state` を経由して動作し、ストア値の変更トラッキングは `createSnapshotPersistAction` が担当します。

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
