<svelte:options runes />

<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    alignImagesForDiff,
    createDiffMaskCanvas,
    createTriptychCanvas,
    downloadCanvasAsPng,
  } from '../domain/diff/diffProcessing';
  import { clamp } from '../util/clamp';
  type Mode = 'overlay' | 'side-by-side' | 'swipe' | 'onion';

  let {
    leftUrl,
    rightUrl,
    leftName = 'screenshot',
    rightName = 'screenshot',
    onClose,
  }: {
    leftUrl: string;
    rightUrl: string;
    leftName?: string;
    rightName?: string;
    onClose?: () => void;
  } = $props();

  let restoreBodyStyles = $state<(() => void) | null>(null);

  let dx = $state(0); // px
  let dy = $state(0); // px
  // 注意: filter はブレンド前に適用されるため、
  // 値を上げると「同一画像でも差分が出る」見え方になります。
  // 初期値は 1 にして、必要時のみ調整します。
  let contrast = $state(1); // ~ 1-8
  let brightness = $state(1); // ~ 0.5-4
  // 保存用のしきい値（0-255）。視覚強調と独立させる。
  let threshold = $state(16);
  // 表示モード
  let mode = $state<Mode>('overlay');
  let reveal = $state(50); // 0-100, swipe 用
  let alpha = $state(0.5); // 0-1, onion 用
  let fullscreen = $state(false);
  // ズーム/パン
  let zoom = $state(1); // 0.25 - 6
  let panX = $state(0);
  let panY = $state(0);
  function resetView() {
    zoom = 1;
    panX = 0;
    panY = 0;
  }

  const VIEW_STATE_KEY = 'domdiffer.viewer.v1';
  function loadViewState() {
    try {
      const raw = localStorage.getItem(VIEW_STATE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw) as Partial<ViewerPersistState>;
      if (s && typeof s === 'object') {
        if (
          s.mode === 'overlay' ||
          s.mode === 'side-by-side' ||
          s.mode === 'swipe' ||
          s.mode === 'onion'
        )
          mode = s.mode;
        if (typeof s.contrast === 'number')
          contrast = clamp(s.contrast, 0.5, 8);
        if (typeof s.brightness === 'number')
          brightness = clamp(s.brightness, 0.5, 4);
        if (typeof s.threshold === 'number')
          threshold = clamp(Math.round(s.threshold), 0, 255);
        if (typeof s.reveal === 'number')
          reveal = clamp(Math.round(s.reveal), 0, 100);
        if (typeof s.alpha === 'number') alpha = clamp(s.alpha, 0, 1);
        if (typeof s.pmIncludeAA === 'boolean') pmIncludeAA = s.pmIncludeAA;
        if (typeof s.pmAlpha === 'number') pmAlpha = clamp(s.pmAlpha, 0, 1);
        if (typeof s.fullscreen === 'boolean') fullscreen = s.fullscreen;
      }
    } catch {}
  }
  type ViewerPersistState = {
    mode: Mode;
    contrast: number;
    brightness: number;
    threshold: number;
    reveal: number;
    alpha: number;
    pmIncludeAA: boolean;
    pmAlpha: number;
    fullscreen: boolean;
  };
  function saveViewState(state: ViewerPersistState) {
    try {
      localStorage.setItem(VIEW_STATE_KEY, JSON.stringify(state));
    } catch {}
  }

  if (typeof window !== 'undefined') {
    loadViewState();
  }
  // Persist when controls change
  $effect(() => {
    saveViewState({
      mode,
      contrast,
      brightness,
      threshold,
      reveal,
      alpha,
      pmIncludeAA,
      pmAlpha,
      fullscreen,
    });
  });

  let baseW = $state(0);
  let baseH = $state(0);
  let overW = $state(0);
  let overH = $state(0);
  let wrapW = $state(0);
  let wrapH = $state(0);
  let wrapEl = $state<HTMLDivElement | null>(null);
  let baseEl = $state<HTMLImageElement | null>(null);
  let overEl = $state<HTMLImageElement | null>(null);
  let viewerEl = $state<HTMLDivElement | null>(null);
  let dragging = $state(false);
  let draggingMode = $state<'pan' | 'offset' | null>(null);
  let lastX = $state(0);
  let lastY = $state(0);
  let startX = $state(0);
  let startY = $state(0);
  let startDX = $state(0);
  let startDY = $state(0);

  function toggleFullscreen() {
    fullscreen = !fullscreen;
  }

  function updateWrapSize() {
    // 基準: 2枚の自然サイズ。オフセットで正側に広がる分は考慮。
    const w = Math.max(baseW, overW + Math.max(0, dx));
    const h = Math.max(baseH, overH + Math.max(0, dy));
    wrapW = w;
    wrapH = h;
  }

  function onBaseLoad(e: Event) {
    if (e.currentTarget === baseEl && baseEl) {
      baseW = baseEl.naturalWidth;
      baseH = baseEl.naturalHeight;
      updateWrapSize();
    }
  }
  function onOverLoad(e: Event) {
    if (e.currentTarget === overEl && overEl) {
      overW = overEl.naturalWidth;
      overH = overEl.naturalHeight;
      updateWrapSize();
    }
  }

  function onKey(e: KeyboardEvent) {
    let step = e.shiftKey ? 10 : 1;
    switch (e.key) {
      case 'ArrowLeft':
        dx -= step;
        e.preventDefault();
        break;
      case 'ArrowRight':
        dx += step;
        e.preventDefault();
        break;
      case 'ArrowUp':
        dy -= step;
        e.preventDefault();
        break;
      case 'ArrowDown':
        dy += step;
        e.preventDefault();
        break;
      case 'Escape':
        onClose?.();
        break;
    }
    updateWrapSize();
  }

  function resetOffsets() {
    dx = 0;
    dy = 0;
    updateWrapSize();
  }

  // pixelmatch options
  let pmIncludeAA = $state(true);
  let pmAlpha = $state(1);

  onMount(() => {
    // フォーカスをモーダルに
    wrapEl?.focus();

    if (typeof document !== 'undefined') {
      const previousOverflow = document.body.style.overflow;
      const previousPadding = document.body.style.paddingRight;
      const previousTouchAction = document.body.style.touchAction;
      const scrollbarGap =
        window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarGap > 0) {
        document.body.style.paddingRight = `${scrollbarGap}px`;
      }
      document.body.style.touchAction = 'none';
      restoreBodyStyles = () => {
        document.body.style.overflow = previousOverflow;
        document.body.style.paddingRight = previousPadding;
        document.body.style.touchAction = previousTouchAction;
      };
    }
  });

  onDestroy(() => {
    restoreBodyStyles?.();
    restoreBodyStyles = null;
  });

  function getAlignedImages() {
    return alignImagesForDiff(baseEl, overEl, dx, dy);
  }

  async function saveDiffMask() {
    const aligned = getAlignedImages();
    if (!aligned) return;
    const diffCanvas = await createDiffMaskCanvas(aligned, {
      threshold,
      includeAA: pmIncludeAA,
      alpha: pmAlpha,
    });
    downloadCanvasAsPng(diffCanvas, leftName, rightName);
  }

  async function saveTriptych() {
    const aligned = getAlignedImages();
    if (!aligned) return;
    const diffCanvas = await createDiffMaskCanvas(aligned, {
      threshold,
      includeAA: pmIncludeAA,
      alpha: pmAlpha,
    });
    const tripCanvas = createTriptychCanvas(aligned, diffCanvas);
    downloadCanvasAsPng(tripCanvas, leftName, rightName);
  }

  function onWheel(e: WheelEvent) {
    if (e.ctrlKey) {
      e.preventDefault();
      const factor = Math.pow(1.001, -e.deltaY);
      zoom = clamp(zoom * factor, 0.25, 6);
    }
  }
  function onPointerDown(e: PointerEvent) {
    if (e.button !== 0) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    startX = e.clientX;
    startY = e.clientY;
    // Shift+ドラッグ: 画像オフセット（overlay系モードのみ）
    if (e.shiftKey && mode !== 'side-by-side') {
      draggingMode = 'offset';
      startDX = dx;
      startDY = dy;
    } else {
      draggingMode = 'pan';
    }
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  }
  function onPointerMove(e: PointerEvent) {
    if (!dragging) return;
    const dxm = e.clientX - lastX;
    const dym = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    if (draggingMode === 'pan') {
      panX += dxm;
      panY += dym;
    } else if (draggingMode === 'offset') {
      const totalDX = (e.clientX - startX) / zoom;
      const totalDY = (e.clientY - startY) / zoom;
      dx = Math.round(startDX + totalDX);
      dy = Math.round(startDY + totalDY);
      updateWrapSize();
    }
  }
  function onPointerUp(e: PointerEvent) {
    dragging = false;
    draggingMode = null;
    (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
  }
</script>

<div class="modal-backdrop">
  <div
    class="modal"
    class:fullscreen
    role="dialog"
    aria-modal="true"
    aria-label="差分ビューア"
    onkeydown={onKey}
    tabindex="0"
    bind:this={wrapEl}
  >
    <header class="modal-header">
      <h2>差分ビューア</h2>
      <div class="header-actions">
        <button
          type="button"
          class="icon"
          onclick={toggleFullscreen}
          aria-label={fullscreen ? '通常表示に戻す' : '全画面表示に切り替える'}
          title={fullscreen ? '通常表示に戻す' : '全画面表示'}
        >
          ⛶
        </button>
        <button
          type="button"
          class="icon"
          onclick={() => onClose?.()}
          aria-label="閉じる"
        >
          ✕
        </button>
      </div>
    </header>
    <section class="modal-body">
      <div
        class="viewer {draggingMode === 'pan'
          ? 'grabbing'
          : ''} {draggingMode === 'offset' ? 'moving' : ''}"
        bind:this={viewerEl}
        onwheel={onWheel}
        onpointerdown={onPointerDown}
        onpointermove={onPointerMove}
        onpointerup={onPointerUp}
        onpointerleave={onPointerUp}
        style={`--dx:${dx}px; --dy:${dy}px; --contrast:${contrast}; --brightness:${brightness}; --alpha:${alpha}; --reveal:${reveal}%`}
      >
        <div
          class="stage"
          style={`transform: translate(${panX}px, ${panY}px) scale(${zoom}); transform-origin: 0 0;`}
        >
          {#if mode === 'side-by-side'}
            <div class="side">
              <div class="img-wrap">
                <img class="plain" src={leftUrl} alt="base" draggable="false" />
              </div>
              <div class="img-wrap">
                <img
                  class="plain"
                  src={rightUrl}
                  alt="overlay"
                  draggable="false"
                />
              </div>
            </div>
          {:else}
            <div
              class="diff-wrap"
              style={`width:${wrapW}px; height:${wrapH}px;`}
            >
              <img
                class="base"
                bind:this={baseEl}
                src={leftUrl}
                alt="base"
                onload={onBaseLoad}
                draggable="false"
              />
              {#if mode === 'overlay'}
                <img
                  class="overlay overlay-diff"
                  bind:this={overEl}
                  src={rightUrl}
                  alt="overlay"
                  onload={onOverLoad}
                  draggable="false"
                />
              {:else if mode === 'onion'}
                <img
                  class="overlay overlay-onion"
                  bind:this={overEl}
                  src={rightUrl}
                  alt="overlay"
                  onload={onOverLoad}
                  draggable="false"
                />
              {:else if mode === 'swipe'}
                <img
                  class="overlay overlay-swipe"
                  bind:this={overEl}
                  src={rightUrl}
                  alt="overlay"
                  onload={onOverLoad}
                  draggable="false"
                />
                <div
                  class="swipe-handle"
                  style="left: calc(var(--reveal))"
                ></div>
              {/if}
            </div>
          {/if}
        </div>
      </div>
      <div class="controls">
        <div class="group">
          <label for="zoom">ズーム: {Math.round(zoom * 100)}%</label>
          <input
            id="zoom"
            type="range"
            min="0.25"
            max="6"
            step="0.05"
            bind:value={zoom}
          />
        </div>
        <div class="group">
          <span class="label">表示モード</span>
          <div class="modes">
            <label
              ><input
                type="radio"
                name="mode"
                bind:group={mode}
                value="overlay"
              /> オーバーレイ</label
            >
            <label
              ><input
                type="radio"
                name="mode"
                bind:group={mode}
                value="side-by-side"
              /> サイドバイサイド</label
            >
            <label
              ><input
                type="radio"
                name="mode"
                bind:group={mode}
                value="swipe"
              /> スワイプ</label
            >
            <label
              ><input
                type="radio"
                name="mode"
                bind:group={mode}
                value="onion"
              /> オニオン</label
            >
          </div>
        </div>
        <div class="group">
          <label for="contrast">コントラスト: {contrast.toFixed(1)}</label>
          <input
            id="contrast"
            type="range"
            min="0.5"
            max="8"
            step="0.1"
            bind:value={contrast}
          />
        </div>
        <div class="group">
          <label for="brightness">明るさ: {brightness.toFixed(1)}</label>
          <input
            id="brightness"
            type="range"
            min="0.5"
            max="4"
            step="0.1"
            bind:value={brightness}
          />
        </div>
        {#if mode === 'swipe'}
          <div class="group">
            <label for="reveal">スワイプ位置: {reveal}%</label>
            <input
              id="reveal"
              type="range"
              min="0"
              max="100"
              step="1"
              bind:value={reveal}
            />
          </div>
        {/if}
        {#if mode === 'onion'}
          <div class="group">
            <label for="alpha"
              >オニオン不透明度: {Math.round(alpha * 100)}%</label
            >
            <input
              id="alpha"
              type="range"
              min="0"
              max="1"
              step="0.05"
              bind:value={alpha}
            />
          </div>
        {/if}
        <div class="group">
          <label for="threshold">しきい値（保存用）: {threshold}</label>
          <input
            id="threshold"
            type="range"
            min="0"
            max="255"
            step="1"
            bind:value={threshold}
          />
        </div>
        <div class="group">
          <span class="label">Pixelmatch 設定</span>
          <label
            ><input type="checkbox" bind:checked={pmIncludeAA} /> アンチエイリアスを考慮</label
          >
          <label for="pmAlpha"
            >マスク不透明度: {Math.round(pmAlpha * 100)}%</label
          >
          <input
            id="pmAlpha"
            type="range"
            min="0"
            max="1"
            step="0.05"
            bind:value={pmAlpha}
          />
          <div class="hint">
            エッジのギザつき由来の差分を抑制／出力PNGの不透明度を調整します。
          </div>
        </div>

        <div class="group button-rows">
          <div class="button-row">
            <button onclick={resetOffsets}>オフセットをリセット</button>
            <button onclick={resetView}>表示をリセット</button>
          </div>
          <div class="button-row">
            <button onclick={saveDiffMask}>左右マスクを保存</button>
            <button onclick={saveTriptych}>横並び比較を保存</button>
          </div>
        </div>
        <div class="hint">
          矢印キーで±1px（Shiftで±10px） / Shift+ドラッグで画像位置調整 /
          Ctrl+ホイールでズーム
        </div>
      </div>
    </section>
  </div>
  <div
    class="modal-clickout"
    onclick={() => onClose?.()}
    aria-hidden="true"
  ></div>
</div>

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    z-index: 1000;
  }
  .modal-clickout {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.35);
  }
  .modal {
    position: relative;
    background: var(--diff-surface, #fff);
    color: var(--diff-fg, #111);
    width: min(92vw, 1100px);
    max-height: 92vh;
    border-radius: 10px;
    box-shadow: 0 18px 40px rgba(15, 23, 42, 0.25);
    overflow: hidden;
    z-index: 1;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
  }
  .modal.fullscreen {
    width: 100vw;
    height: 100vh;
    max-height: none;
    border-radius: 0;
    box-shadow: none;
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--diff-border, #ececec);
  }
  .modal-header .header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .modal-header h2 {
    font-size: 1.1rem;
    margin: 0;
  }
  .modal-header .icon {
    background: none;
    border: none;
    font-size: 1.1rem;
    cursor: pointer;
  }
  .modal-body {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 260px;
    gap: 1rem;
    padding: 1rem;
    background: var(--diff-surface-alt, #f4f5f6);
    min-height: 0;
  }
  .modal.fullscreen .modal-body {
    grid-template-columns: minmax(0, 1fr) 300px;
    height: 100%;
  }

  .viewer {
    overflow: auto;
    border: 1px solid var(--diff-border, #e8e8e8);
    background: #000;
    display: grid;
    place-items: start;
    padding: 0.5rem;
    position: relative;
    cursor: grab;
    user-select: none;
    min-height: 0;
    max-height: 100%;
  }
  .modal.fullscreen .viewer {
    max-height: none;
    height: 100%;
  }
  .viewer.grabbing {
    cursor: grabbing;
  }
  .viewer.moving {
    cursor: move;
  }
  .stage {
    will-change: transform;
  }
  .diff-wrap {
    position: relative;
  }
  /* 等倍描画: 伸張を避けるため inset:0 は使わず top/left のみ指定 */
  .diff-wrap img {
    position: absolute;
    top: 0;
    left: 0;
    max-width: none;
    -webkit-user-drag: none;
    user-select: none;
    image-rendering: pixelated;
  }
  .diff-wrap .base {
    mix-blend-mode: normal;
    transform: translate(0, 0);
  }
  .diff-wrap .overlay {
    transform: translate(var(--dx), var(--dy));
    pointer-events: none;
  }
  .diff-wrap .overlay.overlay-diff {
    mix-blend-mode: difference;
    filter: contrast(var(--contrast)) brightness(var(--brightness)) saturate(2);
  }
  .diff-wrap .overlay.overlay-onion {
    mix-blend-mode: normal;
    opacity: var(--alpha);
  }
  .diff-wrap .overlay.overlay-swipe {
    mix-blend-mode: normal;
    clip-path: inset(0 calc(100% - var(--reveal)) 0 0);
  }
  .swipe-handle {
    position: absolute;
    top: 0;
    bottom: 0;
    width: 2px;
    background: #0d6efd;
    pointer-events: none;
  }

  .side {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
  .img-wrap {
    background: #111;
    border: 1px solid #222;
    padding: 0.5rem;
    overflow: auto;
  }
  .img-wrap .plain {
    display: block;
    max-width: 100%;
    height: auto;
    -webkit-user-drag: none;
    user-select: none;
  }

  .controls {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    align-items: stretch;
    color: var(--diff-fg, #111);
    min-height: 0;
    max-height: 100%;
    overflow-y: auto;
  }
  .modal.fullscreen .controls {
    max-height: none;
  }
  .modes {
    display: flex;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  .label {
    font-size: 0.9rem;
    color: var(--diff-muted, #555);
    display: block;
    margin-bottom: 0.25rem;
  }
  .group label {
    display: block;
    font-size: 0.9rem;
    color: var(--diff-muted, #555);
    margin-bottom: 0.25rem;
  }
  .group.button-rows {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .button-row {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  .hint {
    font-size: 0.85rem;
    color: var(--diff-muted, #666);
  }

  @media (max-width: 900px) {
    .modal-body {
      grid-template-columns: 1fr;
    }
    .controls {
      max-height: none;
      overflow: visible;
    }
  }
</style>
