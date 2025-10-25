<svelte:options runes />

<script lang="ts">
  type SlotDisplay = {
    url: string;
    name: string;
    label: string;
  };

  let {
    left = null,
    right = null,
    ready = false,
    onDropFiles,
    onChooseFiles,
    onClearLeft,
    onClearRight,
    onReset,
    onSwap,
    onOpenDiff,
  }: {
    left?: SlotDisplay | null;
    right?: SlotDisplay | null;
    ready?: boolean;
    onDropFiles?: (payload: { files: File[] }) => void;
    onChooseFiles?: (payload: {
      slot: 'left' | 'right';
      files: File[];
    }) => void;
    onClearLeft?: () => void;
    onClearRight?: () => void;
    onReset?: () => void;
    onSwap?: () => void;
    onOpenDiff?: () => void;
  } = $props();

  let dragOver = $state(false);
  let leftInput = $state<HTMLInputElement | null>(null);
  let rightInput = $state<HTMLInputElement | null>(null);

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const list = e.dataTransfer?.files;
    if (!list || list.length === 0) return;
    const files: File[] = [];
    for (let i = 0; i < list.length; i += 1) {
      const f = list.item(i);
      if (f) files.push(f);
    }
    if (files.length > 0) {
      onDropFiles?.({ files });
    }
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function triggerChooser(slot: 'left' | 'right') {
    const input = slot === 'left' ? leftInput : rightInput;
    input?.click();
  }

  function handleFileSelection(
    input: HTMLInputElement | null,
    slot: 'left' | 'right'
  ) {
    const list = input?.files;
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    onChooseFiles?.({ slot, files });
    if (input) {
      input.value = '';
    }
  }
</script>

<section
  class="dropzone {dragOver ? 'over' : ''}"
  aria-label="画像を追加"
  ondrop={handleDrop}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
>
  <p>
    ここに画像をドラッグ＆ドロップ / クリックでファイルを選択 /
    クリップボードから貼り付け (png/jpeg/webp)
  </p>
  <div class="slots">
    <div
      class="slot"
      role="button"
      tabindex="0"
      onclick={() => triggerChooser('left')}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerChooser('left');
        }
      }}
    >
      {#if left}
        <img src={left.url} alt={left.name} />
        <div class="slot-meta">
          <span title={left.name}>{left.name}</span>
          <button
            class="link"
            onclick={(event) => {
              event.stopPropagation();
              onClearLeft?.();
            }}
          >
            クリア
          </button>
        </div>
      {:else}
        <div class="placeholder">左（基準）</div>
      {/if}
    </div>
    <div
      class="slot"
      role="button"
      tabindex="0"
      onclick={() => triggerChooser('right')}
      onkeydown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          triggerChooser('right');
        }
      }}
    >
      {#if right}
        <img src={right.url} alt={right.name} />
        <div class="slot-meta">
          <span title={right.name}>{right.name}</span>
          <button
            class="link"
            onclick={(event) => {
              event.stopPropagation();
              onClearRight?.();
            }}
          >
            クリア
          </button>
        </div>
      {:else}
        <div class="placeholder">右（比較）</div>
      {/if}
    </div>
  </div>

  <input
    class="file-input"
    type="file"
    accept="image/png,image/jpeg,image/webp"
    hidden
    bind:this={leftInput}
    onchange={() => handleFileSelection(leftInput, 'left')}
  />
  <input
    class="file-input"
    type="file"
    accept="image/png,image/jpeg,image/webp"
    hidden
    bind:this={rightInput}
    onchange={() => handleFileSelection(rightInput, 'right')}
  />

  <div class="controls">
    <button onclick={() => onReset?.()} disabled={!left && !right}>
      リセット
    </button>
    <button onclick={() => onSwap?.()} disabled={!left && !right}>
      左右入れ替え
    </button>
    {#if ready}
      <button onclick={() => onOpenDiff?.()}>差分を開く</button>
    {/if}
  </div>
</section>

<style>
  .dropzone {
    border: 2px dashed #bbb;
    border-radius: 8px;
    padding: 2rem;
    text-align: center;
    color: #666;
    transition: border-color 0.2s ease;
  }
  .dropzone.over {
    border-color: #0d6efd;
  }
  .slots {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }
  .slot {
    border: 1px solid #dcdcdc;
    border-radius: 6px;
    padding: 0.75rem;
    display: grid;
    gap: 0.5rem;
    cursor: pointer;
    background: #fafafa;
  }
  .slot:hover {
    border-color: #0d6efd;
  }
  .slot img {
    width: 100%;
    height: auto;
    border-radius: 6px;
    object-fit: cover;
  }
  .slot-meta {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    align-items: center;
    font-size: 0.9rem;
    color: #555;
  }
  .placeholder {
    padding: 2rem 0;
    color: #999;
    background: #f5f5f5;
    border-radius: 6px;
  }
  .controls {
    display: flex;
    justify-content: center;
    gap: 1rem;
    margin-top: 1.5rem;
  }
  .controls button {
    min-width: 120px;
  }
  .file-input {
    display: none;
  }
</style>
