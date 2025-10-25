<svelte:options runes />

<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import DiffModal from './components/DiffModal.svelte';
  import HistoryImageModal from './components/HistoryImageModal.svelte';
  import type {
    HistoryEntry,
    SlotSource,
    PlaywrightFormState,
  } from './domain/history/history';
  import HistoryPanel from './components/HistoryPanel.svelte';
  import PlaywrightForm from './components/PlaywrightForm.svelte';
  import ImageDropzone from './components/ImageDropzone.svelte';
  import {
    createFormSnapshot,
    buildScreenshotPayload,
  } from './domain/playwright/config';
  import {
    defaultFormState,
    loadFormState,
    saveFormState,
    clearFormState,
    type StoredFormState,
  } from './domain/playwright/formState';
  import {
    buildShareLink,
    readFormStateFromUrl,
    removeFormStateFromUrl,
  } from './domain/playwright/shareLink';
  import {
    makeItem,
    revokeItem,
    acceptTypes,
    maxBytes,
    type SlotItem,
    type ImgSlot,
  } from './domain/slots/slots';
  import {
    clearHistoryPreviews,
    buildHistoryPreviews,
    type HistoryPreviewMap,
  } from './domain/history/historyPreviews';
  import {
    toSlotSnapshot,
    createFileFromStored,
  } from './domain/history/historyFiles';
  import {
    fetchScreenshotFile,
    ScreenshotRequestError,
    ScreenshotContentError,
    createTimedAbortController,
  } from './domain/playwright/screenshotClient';
  import {
    historyEntriesSubscribe,
    loadHistoryEntries,
    addHistorySnapshot,
    removeHistoryEntry,
    clearAllHistoryEntries,
    isHistoryLoaded as historyStoreLoaded,
  } from './domain/history/historyStore';
  import type { HistoryUnsubscriber } from './domain/history/historyStore';
  import { createSnapshotPersistAction } from './actions/persistSnapshot';

  let errorMsg = $state('');

  let left = $state<ImgSlot | null>(null); // base
  let right = $state<ImgSlot | null>(null); // overlay

  let urlInput = $state(defaultFormState.url);
  let selectorInput = $state(defaultFormState.selector);
  let argsInput = $state(defaultFormState.args);
  let uaInput = $state(defaultFormState.ua);
  let vwInput = $state(defaultFormState.vw);
  let vhInput = $state(defaultFormState.vh);
  let waitForInput = $state(defaultFormState.waitFor);
  let requestTimeoutInput = $state(defaultFormState.requestTimeout);
  let colorSchemeInput = $state(defaultFormState.colorScheme);
  let fetchingLeft = $state(false);
  let fetchingRight = $state(false);
  const abortControllers: Record<'left' | 'right', AbortController | null> = {
    left: null,
    right: null,
  };
  type ApiError = { status: number; message: string; stack?: string };
  let lastError = $state<ApiError | null>(null);
  let urlInputEl = $state<HTMLInputElement | null>(null);
  let selectorInputEl = $state<HTMLInputElement | null>(null);

  let historyEntries = $state<HistoryEntry[]>([]);
  let historyLoaded = $state(false);
  let historyError = $state('');
  let historySaving = $state(false);
  let historySavingCount = $state(0);
  let entryBusy = $state<string[]>([]);
  let suppressHistoryPersist = false;
  let historyPreviews = $state<HistoryPreviewMap>({});
  let historyStoreUnsubscribe: HistoryUnsubscriber | null = null;
  let infoMsg = $state('');
  let lastPersistedState: StoredFormState = { ...defaultFormState };
  let previewImage = $state<{
    src: string;
    label: string;
    cleanup?: () => void;
  } | null>(null);
  const ready = $derived(!!left && !!right);
  let showDiff = $state(false);
  let autoOpened = $state(false);

  const assignFormState = (state: StoredFormState) => {
    urlInput = state.url;
    selectorInput = state.selector;
    argsInput = state.args;
    uaInput = state.ua;
    vwInput = state.vw;
    vhInput = state.vh;
    waitForInput = state.waitFor;
    requestTimeoutInput = state.requestTimeout;
    colorSchemeInput = state.colorScheme;
  };
  const currentFormState = (): StoredFormState => ({
    url: urlInput,
    selector: selectorInput,
    args: argsInput,
    ua: uaInput,
    vw: vwInput,
    vh: vhInput,
    waitFor: waitForInput,
    requestTimeout: requestTimeoutInput,
    colorScheme: colorSchemeInput,
  });
  const statesEqual = (a: StoredFormState, b: StoredFormState): boolean =>
    a.url === b.url &&
    a.selector === b.selector &&
    a.args === b.args &&
    a.ua === b.ua &&
    a.vw === b.vw &&
    a.vh === b.vh &&
    a.waitFor === b.waitFor &&
    a.requestTimeout === b.requestTimeout &&
    a.colorScheme === b.colorScheme;
  const cloneStoredState = (state: StoredFormState): StoredFormState => ({
    ...state,
  });
  const formStatePersistence = createSnapshotPersistAction<StoredFormState>({
    getSnapshot: currentFormState,
    onPersist: (next) => {
      lastPersistedState = cloneStoredState(next);
      saveFormState(lastPersistedState);
    },
    compare: statesEqual,
    clone: cloneStoredState,
    initial: lastPersistedState,
  });
  const persistForm = formStatePersistence.action;
  const setPersistBaseline = (state: StoredFormState) => {
    lastPersistedState = cloneStoredState(state);
    formStatePersistence.setBaseline(lastPersistedState);
  };
  async function clearSavedAppState() {
    clearFormState();
    const nextState = { ...defaultFormState };
    assignFormState(nextState);
    setPersistBaseline(nextState);
    await tick();
    infoMsg = '';
    urlInputEl?.focus();
  }
  function sanitizeSelector(value: string): string {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : 'body';
  }
  function createSlotLabel(resourceUrl: string, selector: string): string {
    try {
      const host = new URL(resourceUrl).hostname || 'page';
      return `${host} ${selector}`;
    } catch {
      return `page ${selector}`;
    }
  }
  function markEntryBusy(id: string, busy: boolean) {
    if (busy) {
      if (!entryBusy.includes(id)) entryBusy = [...entryBusy, id];
    } else {
      entryBusy = entryBusy.filter((x) => x !== id);
    }
  }

  function resetHistoryPreviews(entries: HistoryEntry[]) {
    historyPreviews = clearHistoryPreviews(historyPreviews);
    historyPreviews = buildHistoryPreviews(entries);
  }

  async function applyPlaywrightForm(form: PlaywrightFormState) {
    const next: StoredFormState = {
      url: form.url ?? '',
      selector: form.selector ?? '',
      args: form.args ?? '',
      ua: form.ua ?? '',
      vw: form.vw ?? '',
      vh: form.vh ?? '',
      waitFor: form.waitFor ?? '',
      requestTimeout: form.requestTimeout ?? defaultFormState.requestTimeout,
      colorScheme: form.colorScheme ?? '',
    };
    assignFormState(next);
    setPersistBaseline(next);
    saveFormState(lastPersistedState);
    await tick();
    if (urlInputEl) {
      urlInputEl.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      urlInputEl.focus();
    }
  }

  async function refreshHistory() {
    try {
      historyError = '';
      await loadHistoryEntries();
      historyLoaded = true;
    } catch (e) {
      historyError =
        e instanceof Error
          ? e.message
          : `履歴の取得に失敗しました: ${String(e)}`;
    }
  }

  async function saveImageToHistory(slotItem: NonNullable<ImgSlot>) {
    historySavingCount += 1;
    try {
      historySaving = true;
      historyError = '';
      await addHistorySnapshot(toSlotSnapshot(slotItem));
      historyLoaded = true;
    } catch (e) {
      historyError =
        e instanceof Error
          ? e.message
          : `履歴の保存に失敗しました: ${String(e)}`;
    } finally {
      historySavingCount = Math.max(0, historySavingCount - 1);
      historySaving = historySavingCount > 0;
    }
  }

  async function clearAllHistory() {
    historySavingCount += 1;
    try {
      historySaving = true;
      historyError = '';
      await clearAllHistoryEntries();
      entryBusy = [];
      historyLoaded = true;
    } catch (e) {
      historyError =
        e instanceof Error
          ? e.message
          : `履歴の削除に失敗しました: ${String(e)}`;
    } finally {
      historySavingCount = Math.max(0, historySavingCount - 1);
      historySaving = historySavingCount > 0;
    }
  }

  async function handleDelete(entry: HistoryEntry) {
    markEntryBusy(entry.id, true);
    try {
      historyError = '';
      await removeHistoryEntry(entry.id);
    } catch (e) {
      historyError =
        e instanceof Error
          ? e.message
          : `履歴の削除に失敗しました: ${String(e)}`;
    } finally {
      markEntryBusy(entry.id, false);
    }
  }

  function loadHistoryImage(entry: HistoryEntry, slot: 'left' | 'right') {
    markEntryBusy(entry.id, true);
    suppressHistoryPersist = true;
    try {
      historyError = '';
      const file = createFileFromStored(entry.image);
      setSlot(slot, file, {
        labelOverride: entry.image.label,
        source: entry.image.source,
      });
    } catch (e) {
      historyError =
        e instanceof Error
          ? e.message
          : `履歴からの再読み込みに失敗しました: ${String(e)}`;
    } finally {
      suppressHistoryPersist = false;
      markEntryBusy(entry.id, false);
    }
  }

  function openPreviewImage(entry: HistoryEntry, blobUrl?: string) {
    if (previewImage?.cleanup) {
      previewImage.cleanup();
    }
    if (blobUrl) {
      previewImage = {
        src: blobUrl,
        label: entry.image.label,
      };
      return;
    }
    const file = createFileFromStored(entry.image);
    const url = URL.createObjectURL(file);
    previewImage = {
      src: url,
      label: entry.image.label,
      cleanup: () => URL.revokeObjectURL(url),
    };
  }

  function closePreviewImage() {
    if (previewImage?.cleanup) {
      previewImage.cleanup();
    }
    previewImage = null;
  }

  function dismissError() {
    errorMsg = '';
    lastError = null;
  }

  function dismissInfo() {
    infoMsg = '';
  }

  // load saved preferences on mount (separate onMount to avoid touching existing block)
  onMount(() => {
    const storedState = loadFormState();
    assignFormState(storedState);
    setPersistBaseline(storedState);

    const queryState = readFormStateFromUrl();
    if (queryState) {
      assignFormState(queryState);
      setPersistBaseline(queryState);
      saveFormState(queryState);
      removeFormStateFromUrl();
    }
    historyStoreUnsubscribe = historyEntriesSubscribe((entries) => {
      historyEntries = entries;
      if (historyStoreLoaded()) {
        historyLoaded = true;
      }
      resetHistoryPreviews(entries);
    });
    if (!historyStoreLoaded()) {
      void refreshHistory();
    } else {
      historyLoaded = true;
      resetHistoryPreviews(historyEntries);
    }
  });

  async function copyShareLink(): Promise<void> {
    const state = currentFormState();
    try {
      const link = buildShareLink(state);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = link;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'absolute';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const ok = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!ok) {
          throw new Error('Copy command failed');
        }
      }
      infoMsg = 'フォーム設定の共有リンクをコピーしました。';
      errorMsg = '';
    } catch (error) {
      infoMsg = '';
      errorMsg =
        error instanceof Error
          ? `共有リンクのコピーに失敗しました: ${error.message}`
          : '共有リンクのコピーに失敗しました。';
    }
  }

  function clear(slot: 'left' | 'right') {
    if (slot === 'left') {
      revokeItem(left);
      left = null;
    } else {
      revokeItem(right);
      right = null;
    }
  }

  function resetAll() {
    clear('left');
    clear('right');
    errorMsg = '';
    autoOpened = false;
  }

  function swapSlots() {
    if (!left && !right) return;
    [left, right] = [right, left];
  }

  function addFile(file: File, origin: 'upload' | 'paste') {
    if (!acceptTypes.has(file.type)) {
      errorMsg = `未対応の形式: ${file.type}`;
      return;
    }
    if (file.size > maxBytes) {
      errorMsg = `ファイルサイズ超過（上限 ${(maxBytes / (1024 * 1024)).toFixed(0)}MB）`;
      return;
    }
    const target: 'left' | 'right' = !left
      ? 'left'
      : !right
        ? 'right'
        : 'right';
    setSlot(target, file, { source: { kind: origin } });
  }

  // 指定スロットに明示的に設定（URLの解放も安全に実施）
  function setSlot(
    slot: 'left' | 'right',
    file: File,
    options: { labelOverride?: string; source: SlotSource }
  ) {
    const base = makeItem(file, {
      labelOverride: options.labelOverride,
      defaultName: 'screenshot.png',
    });
    const item: SlotItem = { ...base, source: options.source };
    if (slot === 'left') {
      revokeItem(left);
      left = item;
    } else {
      revokeItem(right);
      right = item;
    }
    errorMsg = '';
    autoOpened = false;
    if (!suppressHistoryPersist) {
      void saveImageToHistory(item);
    }
  }

  // 共通: File から表示用アイテムを生成（ObjectURL と表示名）
  function addFiles(files: FileList | File[], origin: 'upload' | 'paste') {
    const arr = Array.from(files).filter((f) => acceptTypes.has(f.type));
    if (arr.length === 0) {
      errorMsg = '画像ファイル（png/jpeg/webp）を指定してください';
      return;
    }
    for (const f of arr.slice(0, 2)) addFile(f, origin);
  }

  function addFileToSlot(slot: 'left' | 'right', file: File) {
    if (!acceptTypes.has(file.type)) {
      errorMsg = `未対応の形式: ${file.type}`;
      return;
    }
    if (file.size > maxBytes) {
      errorMsg = `ファイルサイズ超過（上限 ${(maxBytes / (1024 * 1024)).toFixed(0)}MB）`;
      return;
    }
    setSlot(slot, file, { source: { kind: 'upload' } });
  }

  function handleChosenFiles(slot: 'left' | 'right', files: File[]) {
    for (const file of files) {
      if (!acceptTypes.has(file.type)) {
        errorMsg = `未対応の形式: ${file.type}`;
        continue;
      }
      if (file.size > maxBytes) {
        errorMsg = `ファイルサイズ超過（上限 ${(maxBytes / (1024 * 1024)).toFixed(0)}MB）`;
        continue;
      }
      addFileToSlot(slot, file);
      return;
    }
  }

  async function fetchScreenshot(slot: 'left' | 'right') {
    const normalizedUrl = urlInput.trim();
    if (!normalizedUrl) {
      errorMsg = 'Please enter a URL';
      return;
    }
    const selector = sanitizeSelector(selectorInput);

    abortControllers[slot]?.abort();
    const { controller, cleanup, didTimeout } =
      createTimedAbortController(requestTimeoutInput);
    abortControllers[slot] = controller;

    try {
      infoMsg = '';
      if (slot === 'left') fetchingLeft = true;
      else fetchingRight = true;
      errorMsg = '';
      const formInputs = currentFormState();
      const payload = buildScreenshotPayload({
        ...formInputs,
        url: normalizedUrl,
        selector,
      });
      const formSnapshot = createFormSnapshot(formInputs);

      const file = await fetchScreenshotFile(payload, controller.signal);
      const slotLabel = createSlotLabel(normalizedUrl, selector);
      setSlot(slot, file, {
        labelOverride: slotLabel,
        source: {
          kind: 'playwright',
          payload,
          form: formSnapshot,
        },
      });
    } catch (e) {
      if (controller.signal.aborted) {
        if (didTimeout()) {
          const ms = Number(requestTimeoutInput);
          const duration =
            Number.isFinite(ms) && ms > 0
              ? ms
              : Number(defaultFormState.requestTimeout);
          errorMsg = `Request timed out (${Math.round(duration)}ms)`;
        } else {
          errorMsg = '';
        }
        lastError = null;
      } else if (e instanceof ScreenshotRequestError) {
        lastError = {
          status: e.status,
          message: e.message,
          stack: e.stackTrace,
        };
        errorMsg = `API error ${e.status}: ${e.message}`;
        if (e.status === 404) {
          selectorInputEl?.focus();
        } else if (e.status === 400) {
          urlInputEl?.focus();
        }
      } else if (e instanceof ScreenshotContentError) {
        errorMsg = e.message;
        lastError = null;
      } else {
        errorMsg = `Network error: ${e instanceof Error ? e.message : String(e)}`;
        lastError = null;
      }
    } finally {
      cleanup();
      if (abortControllers[slot] === controller) {
        abortControllers[slot] = null;
      }
      if (slot === 'left') fetchingLeft = false;
      else fetchingRight = false;
    }
  }
  function cancelFetch(slot: 'left' | 'right') {
    const controller = abortControllers[slot];
    if (!controller) return;
    controller.abort();
    abortControllers[slot] = null;
    if (slot === 'left') fetchingLeft = false;
    else fetchingRight = false;
    errorMsg = '';
    lastError = null;
  }

  function onPaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const it of items) {
      if (it.kind === 'file') {
        const f = it.getAsFile();
        if (f) files.push(f);
      }
    }
    if (files.length > 0) addFiles(files, 'paste');
  }

  // ページ離脱時などに ObjectURL を確実に解放
  onDestroy(() => {
    historyStoreUnsubscribe?.();
    if (previewImage?.cleanup) {
      previewImage.cleanup();
    }
    previewImage = null;
    historyPreviews = clearHistoryPreviews(historyPreviews);
    revokeItem(left);
    revokeItem(right);
  });

  $effect(() => {
    if (ready && !showDiff && !autoOpened) {
      // auto open diff modal once both slots have images
      showDiff = true;
      autoOpened = true;
    }
  });
</script>

<svelte:window onpaste={onPaste} />

<main>
  <header>
    <h1>Selector Snapshot Diff</h1>
    <p class="tagline">
      Playwright で任意の URL／selector
      のスクリーンショットを取得し、その場で左右比較・差分強調できるツールです。取得した画像はブラウザのローカルに履歴として保存されるため、過去のスクショを呼び出して再比較したり、Playwright
      の設定をワンクリックで復元したりでき、同じ対象のリグレッション確認が手早く行えます。
    </p>
  </header>

  <div use:persistForm>
    <PlaywrightForm
      bind:urlInputRef={urlInputEl}
      bind:selectorInputRef={selectorInputEl}
      bind:url={urlInput}
      bind:selector={selectorInput}
      bind:ua={uaInput}
      bind:viewportWidth={vwInput}
      bind:viewportHeight={vhInput}
      bind:waitFor={waitForInput}
      bind:requestTimeout={requestTimeoutInput}
      bind:colorScheme={colorSchemeInput}
      bind:args={argsInput}
      {fetchingLeft}
      {fetchingRight}
      onFetch={({ slot }) => fetchScreenshot(slot)}
      onCancel={({ slot }) => cancelFetch(slot)}
      onClear={clearSavedAppState}
      onCopyLink={() => void copyShareLink()}
    />
  </div>

  {#if errorMsg}
    <div class="message warning" role="alert" aria-live="polite">
      <p class="message-text">{errorMsg}</p>
      <button
        type="button"
        class="message-close"
        aria-label="エラーを閉じる"
        onclick={dismissError}
      >
        ×
      </button>
    </div>
    {#if lastError?.stack}
      <details class="error-details" open>
        <summary>エラー詳細</summary>
        <pre>{lastError.stack}</pre>
      </details>
    {/if}
  {/if}

  {#if infoMsg}
    <div class="message info" role="status" aria-live="polite">
      <p class="message-text">{infoMsg}</p>
      <button
        type="button"
        class="message-close"
        aria-label="メッセージを閉じる"
        onclick={dismissInfo}
      >
        ×
      </button>
    </div>
  {/if}

  <ImageDropzone
    {left}
    {right}
    {ready}
    onDropFiles={({ files }) => addFiles(files, 'upload')}
    onChooseFiles={({ slot, files }) => handleChosenFiles(slot, files)}
    onClearLeft={() => clear('left')}
    onClearRight={() => clear('right')}
    onReset={resetAll}
    onSwap={swapSlots}
    onOpenDiff={() => (showDiff = true)}
  />

  <HistoryPanel
    entries={historyEntries}
    loaded={historyLoaded}
    error={historyError}
    saving={historySaving}
    busyIds={entryBusy}
    previews={historyPreviews}
    onDeleteEntry={(entry) => handleDelete(entry)}
    onLoadImage={({ entry, slot }) => loadHistoryImage(entry, slot)}
    onApplyPlaywrightForm={(state) => void applyPlaywrightForm(state)}
    onClearAll={() => void clearAllHistory()}
    onPreviewImage={({ entry, blobUrl }) => openPreviewImage(entry, blobUrl)}
  />

  {#if showDiff && left && right}
    <DiffModal
      leftUrl={left.url}
      rightUrl={right.url}
      leftName={left.label}
      rightName={right.label}
      onClose={() => (showDiff = false)}
    />
  {/if}

  {#if previewImage}
    <HistoryImageModal
      src={previewImage.src}
      alt={previewImage.label}
      onClose={closePreviewImage}
    />
  {/if}
</main>
