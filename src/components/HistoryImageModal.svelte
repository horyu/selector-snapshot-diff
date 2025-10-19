<script lang="ts">
  import { onDestroy, onMount } from 'svelte';

  export let src: string;
  export let alt: string = '';

  export let onClose: (() => void) | undefined;
  let dialogEl: HTMLDialogElement | null = null;
  let previousOverflow = '';
  let previousPadding = '';
  let previousTouchAction = '';

  onMount(() => {
    if (typeof document !== 'undefined') {
      previousOverflow = document.body.style.overflow;
      previousPadding = document.body.style.paddingRight;
      previousTouchAction = document.body.style.touchAction;
      const scrollbarGap =
        window.innerWidth - document.documentElement.clientWidth;
      document.body.style.overflow = 'hidden';
      if (scrollbarGap > 0) {
        document.body.style.paddingRight = `${scrollbarGap}px`;
      }
      document.body.style.touchAction = 'none';
    }

    dialogEl?.showModal();
    dialogEl?.focus();
  });

  onDestroy(() => {
    dialogEl?.close();
    if (typeof document !== 'undefined') {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPadding;
      document.body.style.touchAction = previousTouchAction;
    }
  });

  function onKeyDown(event: KeyboardEvent) {
    if (['Escape', 'Enter', ' '].includes(event.key)) {
      event.preventDefault();
      onClose?.();
    }
  }
</script>

<dialog
  class="history-image-modal"
  bind:this={dialogEl}
  on:click={() => onClose?.()}
  on:keydown={onKeyDown}
>
  <img {src} {alt} />
</dialog>

<style>
  .history-image-modal {
    border: none;
    padding: 0.75rem;
    max-width: min(90vw, 1400px);
    max-height: 90vh;
    background: rgba(17, 17, 17, 0.96);
    box-shadow: 0 24px 48px rgba(15, 23, 42, 0.45);
    border-radius: 10px;
    display: grid;
    place-items: center;
  }

  .history-image-modal::backdrop {
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(2px);
  }

  /* 画像を全て表示するため border-radius を設定しない */
  .history-image-modal img {
    max-width: 100%;
    max-height: 82vh;
    object-fit: contain;
    background: #1f1f1f;
  }
</style>
