<svelte:options runes />

<script lang="ts">
  import type {
    HistoryEntry,
    PlaywrightFormState,
  } from '../domain/history/history';
  import { MAX_HISTORY_ENTRIES } from '../domain/history/history';
  import {
    describeHistorySource,
    formatHistoryBytes,
    formatHistoryTimestamp,
    getPlaywrightHistorySelector,
    isPlaywrightHistorySource,
    summarizePlaywrightHistoryUrl,
  } from '../domain/history/historyPresentation';

  let {
    entries = [] as HistoryEntry[],
    loaded = false,
    error = '',
    saving = false,
    busyIds = [] as string[],
    previews = {} as Record<string, string>,
    onDeleteEntry,
    onLoadImage,
    onApplyPlaywrightForm,
    onClearAll,
    onPreviewImage,
  }: {
    entries?: HistoryEntry[];
    loaded?: boolean;
    error?: string;
    saving?: boolean;
    busyIds?: string[];
    previews?: Record<string, string>;
    onDeleteEntry?: (entry: HistoryEntry) => void;
    onLoadImage?: (payload: {
      entry: HistoryEntry;
      slot: 'left' | 'right';
    }) => void;
    onApplyPlaywrightForm?: (state: PlaywrightFormState) => void;
    onClearAll?: () => void;
    onPreviewImage?: (payload: {
      entry: HistoryEntry;
      blobUrl?: string;
    }) => void;
  } = $props();

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
      onclick={handleClearAll}
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
        {@const sourceDescription = describeHistorySource(entry.image.source)}
        <li class="history-item">
          <button
            class="history-preview"
            onclick={() =>
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
                  {formatHistoryTimestamp(entry.createdAt)}
                </time>
                {#if entry.image.size}
                  <span class="history-size"
                    >{formatHistoryBytes(entry.image.size)}</span
                  >
                {/if}
                <div class="history-header-right">
                  {#if sourceDescription}
                    <span class="history-source">{sourceDescription}</span>
                  {/if}
                  {#if isPlaywrightHistorySource(entry.image.source)}
                    {@const pwSourceHeader = entry.image.source}
                    <button
                      class="link"
                      onclick={() =>
                        onApplyPlaywrightForm?.(pwSourceHeader.form)}
                    >
                      設定を復元
                    </button>
                  {/if}
                </div>
              </div>
              <button
                class="link danger"
                onclick={() => onDeleteEntry?.(entry)}
                disabled={isEntryBusy(entry.id) || saving}
              >
                削除
              </button>
            </header>
            <div class="history-label">
              {#if isPlaywrightHistorySource(entry.image.source)}
                {@const pwSource = entry.image.source}
                {@const playUrlSummary = summarizePlaywrightHistoryUrl(
                  pwSource.payload.url
                )}
                {@const playSelector = getPlaywrightHistorySelector(pwSource)}
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
                onclick={() => onLoadImage?.({ entry, slot: 'left' })}
                disabled={isEntryBusy(entry.id) || saving}
              >
                左に読み込む
              </button>
              <button
                onclick={() => onLoadImage?.({ entry, slot: 'right' })}
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
