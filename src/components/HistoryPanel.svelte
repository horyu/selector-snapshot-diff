<script lang="ts">
  import type {
    HistoryEntry,
    SlotSource,
    PlaywrightFormState,
  } from '../domain/history/history';
  import { MAX_HISTORY_ENTRIES } from '../domain/history/history';

  export let entries: HistoryEntry[] = [];
  export let loaded = false;
  export let error = '';
  export let saving = false;
  export let busyIds: string[] = [];
  export let previews: Record<string, string> = {};
  export let onDeleteEntry: ((entry: HistoryEntry) => void) | undefined;
  export let onLoadImage:
    | ((payload: { entry: HistoryEntry; slot: 'left' | 'right' }) => void)
    | undefined;
  export let onApplyPlaywrightForm:
    | ((state: PlaywrightFormState) => void)
    | undefined;
  export let onClearAll: (() => void) | undefined;
  export let onPreviewImage:
    | ((payload: { entry: HistoryEntry; blobUrl?: string }) => void)
    | undefined;

  const historyDateFormatter = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  function formatTimestamp(ts: number) {
    try {
      return historyDateFormatter.format(new Date(ts));
    } catch {
      const d = new Date(ts);
      return Number.isFinite(d.getTime()) ? d.toLocaleString() : '';
    }
  }

  function formatBytes(bytes: number | undefined) {
    if (!Number.isFinite(bytes) || !bytes || bytes <= 0) return '';
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${bytes} B`;
  }

  function describeSource(source: SlotSource) {
    switch (source.kind) {
      case 'upload':
        return 'ファイルアップロード';
      case 'paste':
        return 'クリップボード';
      case 'playwright':
        return 'Playwright';
      default:
        return '';
    }
  }

  function isPlaywrightSource(
    source: SlotSource
  ): source is Extract<SlotSource, { kind: 'playwright' }> {
    return source.kind === 'playwright';
  }

  function summarizePlaywrightUrl(url: string) {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname || '/';
      const search = parsed.search ?? '';
      const hash = parsed.hash ?? '';
      return `${parsed.host}${pathname}${search}${hash}`;
    } catch {
      return url.replace(/^[a-z]+:\/\//i, '');
    }
  }

  function describeSourceForHeader(source: SlotSource) {
    return describeSource(source);
  }

  function getPlaywrightSelector(
    source: Extract<SlotSource, { kind: 'playwright' }>
  ) {
    return source.payload.selector ?? '';
  }

  function isEntryBusy(id: string) {
    return busyIds.includes(id);
  }

  function handleClearAll() {
    if (saving || entries.length === 0) return;
    if (
      window.confirm('保存されている履歴をすべて削除します。よろしいですか？')
    ) {
      onClearAll?.();
    }
  }
</script>

<section class="history-box" aria-label="履歴">
  <div class="history-head">
    <div class="history-head-info">
      <h2>履歴</h2>
      <span class="history-count"
        >({entries.length} / {MAX_HISTORY_ENTRIES})</span
      >
    </div>
    <button
      type="button"
      class="link danger history-clear-all"
      on:click={handleClearAll}
      disabled={saving || entries.length === 0}
    >
      全削除
    </button>
  </div>
  {#if error}
    <p class="history-error" role="status">{error}</p>
  {/if}
  {#if !loaded && entries.length === 0}
    <p class="history-empty">読み込み中です…</p>
  {:else if entries.length === 0}
    <p class="history-empty">履歴はまだありません。</p>
  {:else}
    <ul class="history-list">
      {#each entries as entry (entry.id)}
        {@const sourceDescription = describeSourceForHeader(entry.image.source)}
        <li class="history-item">
          <button
            class="history-preview"
            on:click={() =>
              onPreviewImage?.({
                entry,
                blobUrl: previews[entry.id],
              })}
            type="button"
            aria-label={`${entry.image.label} を原寸表示する`}
          >
            {#if previews[entry.id]}
              <img
                src={previews[entry.id]}
                alt={`${entry.image.label}のプレビュー`}
                loading="lazy"
              />
            {:else}
              <span class="placeholder">No image</span>
            {/if}
          </button>
          <div class="history-main">
            <header class="history-item-header">
              <div class="history-meta-row">
                <time
                  class="history-created"
                  datetime={new Date(entry.createdAt).toISOString()}
                >
                  {formatTimestamp(entry.createdAt)}
                </time>
                {#if entry.image.size}
                  <span class="history-size"
                    >{formatBytes(entry.image.size)}</span
                  >
                {/if}
                <div class="history-header-right">
                  {#if sourceDescription}
                    <span class="history-source">{sourceDescription}</span>
                  {/if}
                  {#if isPlaywrightSource(entry.image.source)}
                    {@const pwSourceHeader = entry.image.source}
                    <button
                      class="link"
                      on:click={() =>
                        onApplyPlaywrightForm?.(pwSourceHeader.form)}
                    >
                      設定を復元
                    </button>
                  {/if}
                </div>
              </div>
              <button
                class="link danger"
                on:click={() => onDeleteEntry?.(entry)}
                disabled={isEntryBusy(entry.id) || saving}
              >
                削除
              </button>
            </header>
            <div class="history-label">
              {#if isPlaywrightSource(entry.image.source)}
                {@const pwSource = entry.image.source}
                {@const playUrlSummary = summarizePlaywrightUrl(
                  pwSource.payload.url
                )}
                {@const playSelector = getPlaywrightSelector(pwSource)}
                <span class="history-label-content">
                  <a
                    class="history-label-link"
                    href={pwSource.payload.url}
                    target="_blank"
                    rel="noreferrer"
                    title={pwSource.payload.url}
                  >
                    {playUrlSummary}
                  </a>
                  {#if playSelector}
                    <span class="history-label-selector" title={playSelector}>
                      {playSelector}
                    </span>
                  {/if}
                </span>
              {:else}
                <span class="history-label-content" title={entry.image.label}>
                  {entry.image.label}
                </span>
              {/if}
            </div>
            <div class="history-actions">
              <button
                on:click={() => onLoadImage?.({ entry, slot: 'left' })}
                disabled={isEntryBusy(entry.id) || saving}
              >
                左に読み込む
              </button>
              <button
                on:click={() => onLoadImage?.({ entry, slot: 'right' })}
                disabled={isEntryBusy(entry.id) || saving}
              >
                右に読み込む
              </button>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .history-preview {
    width: 120px;
    height: 90px;
    border: none;
    border-radius: 8px;
    padding: 0;
    margin: 0;
    overflow: hidden;
    cursor: pointer;
    display: grid;
    place-items: center;
    background: transparent;
  }

  .history-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .history-preview .placeholder {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    background: #f4f4f5;
    color: #7c7c7c;
    font-size: 0.75rem;
  }

  .history-preview:focus-visible {
    outline: 2px solid #2563eb;
    outline-offset: 2px;
  }
</style>
