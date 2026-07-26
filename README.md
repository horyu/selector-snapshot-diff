# Selector Snapshot Diff

Selector Snapshot Diff は Playwright を使って任意の URL と selector のスクリーンショットを取得し、左右の画像を比較して差分を強調表示できるローカル Web アプリケーションです。取得した画像や Playwright のフォーム設定はブラウザ内に保存され、過去の状態を呼び出して素早く再比較できます。

---

## 主な機能

- **Playwright 連携**：URL / selector（任意で userAgent, viewport, waitFor, args, colorScheme）を指定して要素のスクリーンショットを取得。左右どちらのスロットに読み込むか選択できます。
- **多様な画像取り込み**：ドラッグ＆ドロップ、ファイル選択、クリップボード貼り付けに対応。Playwright 取得結果も同じ仕組みで左右スロットへ配置できます。
- **履歴パネル**
  - サムネイルとメタ情報（取得時刻、ファイルサイズ、ソース種別、Playwright 情報）を一覧表示。
  - Playwright 履歴は URL と selector をリンク／ラベルとして表示し、その設定をワンクリックでフォームへ復元可能。
  - 取得した画像ファイルはブラウザの IndexedDB に保存され、サーバーには送信しません。
- **差分ビューア**：overlay / side-by-side / swipe / onion の 4 モードを切り替え可能。ヘッダー右上の ⛶ ボタンで全画面表示をトグルでき、ズーム・パン・オフセット調整、コントラスト／明度、Pixelmatch 設定（しきい値・アンチエイリアス除外・マスクのアルファ値）を操作できます。
- **エクスポート**
  - 現在の差分マスクを PNG として保存。
  - 左右の画像を横並びにした比較画像を生成して保存。
  - `image-rendering: pixelated` を適用したシャープ表示に対応。
- **操作性**：オフセット微調整（←→↑↓ / Shift 併用で 1px・10px）、ズーム（Ctrl + ホイール）、リセットや左右入れ替えなどの操作ボタンを備えています。

---

## Quick Start

```bash
# mise でツールを有効化
mise install

# 依存関係のインストール
pnpm install

# （初回 Playwright 利用前に必要に応じてブラウザを取得）
pnpm run playwright:install

# 開発サーバーを起動（Vite UI + Capture Gateway）
pnpm run dev
```

ブラウザで `http://localhost:5173` を開くとアプリが利用できます。

---

## システム構成

- **クライアント**：Vite 8 + Svelte 5（Runes 有効、TypeScript / strict モード）
- **Svelte 設定**：全コンポーネントに `<svelte:options runes />` を明示しつつ、`svelte.config.js` の `compilerOptions.runes = true` で Rune モードをプロジェクト全体に適用
- **スタイリング**：プレーン CSS
- **Lint / Format**：ESLint / `pnpm run format`
- **履歴保存**：`src/domain/history/history.ts` で IndexedDB を利用
- **Capture Gateway**：軽量な HTTP Gateway が `/api/screenshot` を受け付け、リクエストごとの Worker に Playwright キャプチャを委譲します。待機中は Chromium と Playwright Worker を起動しません。
- **共有プロトコル**：`packages/protocol/` の zod スキーマを UI と Gateway で共有しています。
- **アプリケーションオーケストレーション層**：`src/domain/app/` 配下に `formController.ts` / `historyController.ts` / `screenshotController.ts` を配置し、`App.svelte` からフォーム・履歴・スクリーンショットの各ドメイン機能を委譲しています

---

## Rune モードのポイント

- 画面状態は `$state` / `$derived` / `$effect` を中心に管理し、`App.svelte` は `createFormController`・`createHistoryController`・`createScreenshotController` を通じてドメインロジックへ責務委譲しています。従来の Svelte store への依存はドメイン層のカスタム購読（例: `historyStore`）やフォームの `createSnapshotPersistAction` に置き換えています。
- フォーム永続化は `src/actions/persistSnapshot.ts` のアクションを通じて行い、`localStorage` との同期を Rune のリアクティブ文脈から分離しています。
- 共有リンクや履歴復元などの副作用は `$effect.root` 内で AbortController／URL revoke を管理し、メモリリークを防止しています。
- キャプチャフローは `packages/capture-core/` に分離し、グローバルフックではなく Worker 作成時に `CaptureProfile` を注入できる構成です。

---

## アプリのワークフロー

1. **画像取得**
   - 左右スロットにドラッグ＆ドロップ／貼り付け／ファイル選択で画像を読み込む。
   - もしくは Playwright フォームから `/api/screenshot` を呼び出し、要素スクリーンショットを取得してスロットに配置する。
2. **履歴保存**
   - 画像（Blob）とメタ情報（サイズ、ソース種別、Playwright 情報など）を IndexedDB に保存し、一覧やプレビューを更新する。
   - Playwright の履歴には URL と selector をラベルとして保持し、設定復元ボタンからフォームに展開できる。
3. **差分表示**
   - 左右がそろったら差分モーダルを開き、Canvas で描画しつつ Pixelmatch を使ってマスクを計算。
   - 表示モード／フィルタ／Pixelmatch パラメータは `localStorage` に保存され、再訪時に復元される。

---

## 画面と動作概要

### トップ画面

1. **Playwright 取得フォーム**
   - URL / selector / waitFor などを入力し、左または右スロットに取得。
   - `requestTimeout` フィールドはクライアント側のフェッチに対するタイムアウト（AbortController）として扱われ、サーバーには送信されません。
   - フォーム入力値は localStorage に保存され、ブラウザを再読み込みしても復元されます。
2. **画像スロット**
   - 左右それぞれにドラッグ＆ドロップ、ファイル選択、ペーストで画像を読み込み。
   - 画像ごとにソース種別（アップロード / クリップボード / Playwright）が保持されます。
3. **履歴パネル**
   - 最大 `MAX_HISTORY_ENTRIES` 件まで保存。
   - Playwright エントリは「設定を復元」ボタンでフォームへ展開可能。
   - 任意の履歴から画像を左／右どちらかに読み込み可能。
   - サムネイルをクリックするとモーダルでプレビュー（表示領域に収まる範囲で縮尺調整）。

### 差分ビューア（`src/components/DiffModal.svelte`）

- 表示モード：`overlay` / `side-by-side` / `swipe` / `onion`
- オフセット操作：ドラッグまたは矢印キー（Shift 併用で 10px）
- ピクセルフィルタ：コントラスト / 明度を調整
- Pixelmatch 設定：しきい値、アンチエイリアス除外、マスク透過度
- エクスポート：差分マスク、横並び比較の両方を PNG で保存
- 表示品質：`image-rendering: pixelated` でのシャープ表示
- キーボードショートカット
- `Esc`：モーダルを閉じる
  - `Ctrl` + `ホイール`：ズームイン／アウト

---

## 開発環境

```
pnpm install        # 依存関係をインストール
pnpm run dev        # Vite 開発サーバーと Capture Gateway を並行起動
pnpm run build      # 静的 UI を dist/ に生成
pnpm run start      # Gateway が dist/ と /api/screenshot を配信
pnpm run check      # Svelte + TypeScript チェック
pnpm run lint       # ESLint による lint
pnpm run format     # プレーン CSS / TS の整形（prettier 相当）
```

- Playwright はキャプチャ要求時に Worker 内でのみ起動します。初回利用前に `pnpm run playwright:install` を実行してください。

---

## ディレクトリガイド

- `src/App.svelte`：フォーム、スロット、履歴、差分ビューアを束ねるエントリーポイント。
- `src/domain/history/history.ts`：IndexedDB を使った履歴ストア。サムネイル生成やクリーンアップも含む。
- `src/components/HistoryPanel.svelte`：履歴リスト UI。サムネイル、Playwright 情報、設定復元ボタンを提供。
- `src/components/DiffModal.svelte`：差分ビューアと Pixelmatch ベースの処理、各種エクスポート。
- `src/components/ImageDropzone.svelte`：左右スロットへのドロップ／ペースト／ファイル選択制御。
- `packages/capture-gateway/`：静的 UI と `/api/screenshot` を配信する軽量 Gateway。
- `packages/capture-worker/`：要求ごとに起動・終了し、Playwright を実行する Worker。
- `packages/capture-core/`：HTTP やプロセス管理から独立したキャプチャフロー。
- `packages/protocol/`：UI と Gateway が共有する API スキーマ・型。
- `docs/architecture.md`：本 README の補足として、クライアントとサーバーの責務を整理。

---

## Playwright API（開発サーバー向け）

Playwright フォームの下部にある「共有リンクをコピー」ボタンから、URL パラメータ `pw` に Base64 でシリアライズしたリンクを生成できます。リンクを開くとフォーム設定が復元され、その後 `pw` パラメータは自動的に削除されます（機微情報は入力しないでください）。

- 分離構成：`packages/protocol/` が API 契約を共有し、Gateway が Worker を起動、`packages/capture-core/` がキャプチャフローを担います。
- エンドポイント：`POST /api/screenshot`
- リクエスト例：

```json
{
  "url": "https://example.com",
  "selector": "#main",
  "waitFor": ".ready",
  "viewport": { "width": 1280, "height": 720 },
  "userAgent": "Chrome",
  "args": ["--host-resolver-rules=MAP * 127.0.0.1"],
  "colorScheme": "dark"
}
```

- レスポンス：PNG バイナリ（画像全体ではなく selector に一致した要素スクリーンショット）
- 備考：
  - 開発時は Vite の proxy を経由し、本番相当では `pnpm run start` の Gateway が同一オリジンでエンドポイントを提供します。
  - タイムアウトは既定で 15,000ms。`timeout`（ミリ秒）を指定すると上書きできますが、UI のフォームからは送信されません（API を直接呼び出す際に指定してください）。
  - `waitFor` が空の場合でも、キャプチャ処理は `selector`（未指定時は `body`）の出現を `page.waitForSelector` で待機してから撮影します。
  - `selector` が空の場合は自動で `body` を対象。
  - カスタム処理は `capture-core` の `CaptureProfile` として Worker 作成時に注入できます。グローバルな可変フックは使用しません。
- 実行結果は履歴としてブラウザに保存されるだけで、サーバー側には残りません。

---

## 制限事項

- `pnpm run start` はローカル利用を前提に `127.0.0.1:5174` で待ち受けます。外部公開にはリバースプロキシや認証を含む別途の運用設計が必要です。
- `dist/index.html` をファイルとして直接開く（`file://`）方法はサポートしていません。`pnpm run start` 経由で開いてください。

---

## 設定の永続化

- **フォーム入力**：URL、selector、ユーザーエージェント、ビューポート、追加引数、カラー設定などを `createFormController` 経由で `localStorage` に保存。
- **差分ビューア設定**：モード、フィルタ値、Pixelmatch 関連設定を `localStorage` に保存。
- **履歴エントリ**：画像データとメタ情報は IndexedDB の単一オブジェクトストアで管理し、プレビュー表示時は `URL.createObjectURL` で Blob URL を生成します。

---

## 手動検証チェックリスト

リリース前の目視確認に利用できます。

1. `pnpm run dev` → `http://localhost:5173` を開き、フォームが初期化されているか確認（既存の `localStorage` があれば読込）。
2. 既知の URL（例: https://example.com）で `body` セレクタのスクリーンショットを左右スロットに取得し、エラーが出ないことを確認。
3. 片側をファイルアップロード（ドラッグ＆ドロップ／ファイル選択）に切り替えて差分ビューアを開き、モード切替・ズーム・パン操作が動作すること。
4. 「履歴に保存」でエントリが追加され、プレビューのサムネイルが生成されること。履歴から左右スロットへ復元できること。
5. 履歴モーダルで「履歴をすべて削除」を実行し、IndexedDB がクリアされること（リロード後にエントリが残らない）。
6. 「共有リンクをコピー」を押し、コピーした URL を新規タブで開くとフォームが同じ値で復元され、その後クエリ `pw` が自動的に取り除かれること。
7. フォームをクリアしブラウザを再訪すると、`localStorage` に保存された最新値が Rune のストア経由で反映されること。
8. DevTools 等でネットワークを Offline にして Playwright の取得を試み、リクエストエラーが表示され履歴が汚染されないこと。

---

## 差分マスクと比較画像の命名

- 形式：`YYYYMMDDHHmmss [left]-[right].png`（角括弧はそのまま含まれます）
- ラベルは元ファイル名や Playwright 取得時のドメイン＋セレクタなどをサニタイズして生成します
- 制御文字／Windows 禁止文字を除去し、空文字や予約名は `screenshot` にフォールバックします
- 詳細ロジックは `src/util/filename.ts` を参照してください

---

## テストと品質

- `pnpm run check`：型・Svelte コンパイルチェック
- `pnpm run lint`：ESLint による静的解析
- `pnpm run format`：コード整形

Pull Request／コミット前には少なくとも `check` と `lint` の実行を推奨します。

---

## ライセンス

本プロジェクトは [DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE, Version 2](LICENSE) の下で公開されています。著作権表記は下記のとおりです。

```txt
Copyright (C) 2025 horyu
```
