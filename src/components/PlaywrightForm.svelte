<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import FormField from './FormField.svelte';

  export let url = '';
  export let selector = '';
  export let ua = '';
  export let viewportWidth = '';
  export let viewportHeight = '';
  export let waitFor = '';
  export let requestTimeout = '15000';
  export let colorScheme = '';
  export let args = '';
  export let fetchingLeft = false;
  export let fetchingRight = false;
  export let urlInputRef: HTMLInputElement | null = null;
  export let selectorInputRef: HTMLInputElement | null = null;

  const dispatch = createEventDispatcher<{
    fetch: { slot: 'left' | 'right' };
    clear: void;
    copyLink: void;
    cancel: { slot: 'left' | 'right' };
  }>();
  const argsPlaceholder = `例: --disable-web-security\n      --host-resolver-rules="MAP example.com 127.0.0.1"`;

  function onFetch(slot: 'left' | 'right') {
    dispatch('fetch', { slot });
  }

  function onClear() {
    dispatch('clear');
  }

  function onCopyLink() {
    dispatch('copyLink');
  }

  function onCancel(slot: 'left' | 'right') {
    dispatch('cancel', { slot });
  }
</script>

<section class="api-box" aria-label="対象スクリーンショット取得（Playwright）">
  <div class="grid">
    <FormField label="URL">
      <input
        type="url"
        placeholder="https://example.com"
        bind:value={url}
        bind:this={urlInputRef}
      />
    </FormField>
    <FormField label="selector （未指定なら body を使用）">
      <input
        type="text"
        placeholder="例: h1, #app .btn"
        bind:value={selector}
        bind:this={selectorInputRef}
      />
    </FormField>
    <div class="buttons">
      <button
        on:click={() => onFetch('left')}
        disabled={fetchingLeft || fetchingRight}>左に取得</button
      >
      <button
        on:click={() => onFetch('right')}
        disabled={fetchingLeft || fetchingRight}>右に取得</button
      >
      {#if fetchingLeft || fetchingRight}
        <button
          type="button"
          class="link danger"
          on:click={() => onCancel(fetchingLeft ? 'left' : 'right')}
        >
          キャンセル
        </button>
      {/if}
    </div>
    <FormField label="User Agent">
      <input type="text" placeholder="例: Mozilla/5.0 ..." bind:value={ua} />
    </FormField>
    <FormField label="Viewport">
      <div class="vp">
        <input
          type="number"
          min="1"
          step="1"
          placeholder="width"
          bind:value={viewportWidth}
        />
        <span>×</span>
        <input
          type="number"
          min="1"
          step="1"
          placeholder="height"
          bind:value={viewportHeight}
        />
      </div>
    </FormField>
    <FormField label="waitFor（selector）">
      <input type="text" placeholder="例: #loaded" bind:value={waitFor} />
    </FormField>
    <FormField label="requestTimeout(ms)">
      <input
        type="number"
        min="1"
        step="1"
        placeholder="15000"
        bind:value={requestTimeout}
      />
    </FormField>
    <FormField label="colorScheme">
      <select bind:value={colorScheme}>
        <option value="">(指定なし)</option>
        <option value="light">light</option>
        <option value="dark">dark</option>
        <option value="no-preference">no-preference</option>
      </select>
    </FormField>
    <FormField label="Chromium 起動引数（改行区切り）" wide>
      <textarea rows="2" placeholder={argsPlaceholder} bind:value={args}
      ></textarea>
    </FormField>
    <div class="wide form-actions">
      <button type="button" class="link" on:click={onCopyLink}>
        共有リンクをコピー
      </button>
      <button type="button" class="link" on:click={onClear}>
        フォームをクリア
      </button>
    </div>
  </div>
</section>

<style>
  section {
    margin-bottom: 1rem;
  }
</style>
