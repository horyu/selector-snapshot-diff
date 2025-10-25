<svelte:options runes />

<script lang="ts">
  import FormField from './FormField.svelte';

  let {
    url = $bindable(''),
    selector = $bindable(''),
    ua = $bindable(''),
    viewportWidth = $bindable(''),
    viewportHeight = $bindable(''),
    waitFor = $bindable(''),
    requestTimeout = $bindable('15000'),
    colorScheme = $bindable(''),
    args = $bindable(''),
    fetchingLeft = false,
    fetchingRight = false,
    urlInputRef = $bindable<HTMLInputElement | null>(null),
    selectorInputRef = $bindable<HTMLInputElement | null>(null),
    onFetch,
    onClear,
    onCopyLink,
    onCancel,
  }: {
    url?: string;
    selector?: string;
    ua?: string;
    viewportWidth?: string;
    viewportHeight?: string;
    waitFor?: string;
    requestTimeout?: string;
    colorScheme?: string;
    args?: string;
    fetchingLeft?: boolean;
    fetchingRight?: boolean;
    urlInputRef?: HTMLInputElement | null;
    selectorInputRef?: HTMLInputElement | null;
    onFetch?: (payload: { slot: 'left' | 'right' }) => void;
    onClear?: () => void;
    onCopyLink?: () => void;
    onCancel?: (payload: { slot: 'left' | 'right' }) => void;
  } = $props();
  const argsPlaceholder = `Example: --disable-web-security
      --host-resolver-rules="MAP example.com 127.0.0.1"`;
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
        onclick={() => onFetch?.({ slot: 'left' })}
        disabled={fetchingLeft || fetchingRight}>左に取得</button
      >
      <button
        onclick={() => onFetch?.({ slot: 'right' })}
        disabled={fetchingLeft || fetchingRight}>右に取得</button
      >
      {#if fetchingLeft || fetchingRight}
        <button
          type="button"
          class="link danger"
          onclick={() => onCancel?.({ slot: fetchingLeft ? 'left' : 'right' })}
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
      <button type="button" class="link" onclick={() => onCopyLink?.()}>
        共有リンクをコピー
      </button>
      <button type="button" class="link" onclick={() => onClear?.()}>
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
