<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  type SlotDisplay = {
    url: string;
    name: string;
    label: string;
  };

  export let left: SlotDisplay | null = null;
  export let right: SlotDisplay | null = null;
  export let ready = false;

  const dispatch = createEventDispatcher<{
    dropFiles: { files: File[] };
    chooseFiles: { slot: 'left' | 'right'; files: File[] };
    clearLeft: void;
    clearRight: void;
    reset: void;
    swap: void;
    openDiff: void;
  }>();

  let dragOver = false;
  let leftInput: HTMLInputElement | null = null;
  let rightInput: HTMLInputElement | null = null;

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragOver = false;
    const list = e.dataTransfer?.files;
    if (!list || list.length === 0) return;
    const files: File[] = [];
    for (let i = 0; i < list.length; i++) {
      const f = list.item(i);
      if (f) files.push(f);
    }
    if (files.length > 0) dispatch('dropFiles', { files });
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
    dispatch('chooseFiles', { slot, files });
    if (input) input.value = '';
  }
</script>

<section
  class="dropzone {dragOver ? 'over' : ''}"
  aria-label="画像入力"
  on:drop={handleDrop}
  on:dragover={handleDragOver}
  on:dragleave={handleDragLeave}
>
  <p>
    ここに画像をドラッグ＆ドロップ / クリックでファイルを選択 /
    クリップボードから貼り付け（png/jpeg/webp）
  </p>
  <div class="slots">
    <div
      class="slot"
      role="button"
      tabindex="0"
      on:click={() => triggerChooser('left')}
      on:keydown={(e) => {
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
            on:click|stopPropagation={() => dispatch('clearLeft')}
            >クリア</button
          >
        </div>
      {:else}
        <div class="placeholder">左（基準）</div>
      {/if}
    </div>
    <div
      class="slot"
      role="button"
      tabindex="0"
      on:click={() => triggerChooser('right')}
      on:keydown={(e) => {
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
            on:click|stopPropagation={() => dispatch('clearRight')}
            >クリア</button
          >
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
    on:change={() => handleFileSelection(leftInput, 'left')}
  />
  <input
    class="file-input"
    type="file"
    accept="image/png,image/jpeg,image/webp"
    hidden
    bind:this={rightInput}
    on:change={() => handleFileSelection(rightInput, 'right')}
  />

  <div class="controls">
    <button on:click={() => dispatch('reset')} disabled={!left && !right}
      >リセット</button
    >
    <button on:click={() => dispatch('swap')} disabled={!left && !right}
      >左右入れ替え</button
    >
    {#if ready}
      <button on:click={() => dispatch('openDiff')}>差分を開く</button>
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
