<svelte:options runes />

<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import DiffModal from './components/DiffModal.svelte';
  import HistoryImageModal from './components/HistoryImageModal.svelte';
  import HistoryPanel from './components/HistoryPanel.svelte';
  import PlaywrightForm from './components/PlaywrightForm.svelte';
  import ImageDropzone from './components/ImageDropzone.svelte';
  import { createFormController } from './domain/app/formController';
  import {
    createHistoryController,
    type PreviewImage,
  } from './domain/app/historyController';
  import {
    createScreenshotController,
    type ApiError,
  } from './domain/app/screenshotController';
  import type {
    HistoryEntry,
    PlaywrightFormState,
  } from './domain/history/history';
  import type { HistoryPreviewMap } from './domain/history/historyPreviews';
  import type { ImgSlot } from './domain/slots/slots';
  import {
    defaultFormState,
    type StoredFormState,
  } from './domain/playwright/formState';

  let errorMsg = $state('');
  let infoMsg = $state('');
  let lastError = $state<ApiError | null>(null);

  let left = $state<ImgSlot | null>(null);
  let right = $state<ImgSlot | null>(null);

  let urlInput = $state(defaultFormState.url);
  let selectorInput = $state(defaultFormState.selector);
  let argsInput = $state(defaultFormState.args);
  let uaInput = $state(defaultFormState.ua);
  let vwInput = $state(defaultFormState.vw);
  let vhInput = $state(defaultFormState.vh);
  let waitForInput = $state(defaultFormState.waitFor);
  let requestTimeoutInput = $state(defaultFormState.requestTimeout);
  let colorSchemeInput = $state(defaultFormState.colorScheme);

  let urlInputEl = $state<HTMLInputElement | null>(null);
  let selectorInputEl = $state<HTMLInputElement | null>(null);

  let fetchingLeft = $state(false);
  let fetchingRight = $state(false);

  let historyEntries = $state<HistoryEntry[]>([]);
  let historyLoaded = $state(false);
  let historyError = $state('');
  let historySaving = $state(false);
  let entryBusy = $state<string[]>([]);
  let historyPreviews = $state<HistoryPreviewMap>({});
  let previewImage = $state<PreviewImage | null>(null);

  let showDiff = $state(false);
  let autoOpened = $state(false);

  const ready = $derived(!!left && !!right);

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

  const formController = createFormController({
    assignFormState,
    getCurrentFormState: currentFormState,
    focusUrlInput: () => {
      urlInputEl?.focus();
    },
    setInfoMessage: (message) => {
      infoMsg = message;
    },
    clearInfoMessage: () => {
      infoMsg = '';
    },
    setErrorMessage: (message) => {
      errorMsg = message;
    },
    clearErrorMessage: () => {
      errorMsg = '';
    },
    clearLastError: () => {
      lastError = null;
    },
    tick,
  });

  const {
    persistFormAction: persistForm,
    setPersistBaseline,
    loadInitialState: loadInitialFormState,
    clearSavedState: clearSavedAppState,
    copyShareLink,
    sanitizeSelector,
    createSlotLabel,
  } = formController;

  const historyController = createHistoryController({
    getEntries: () => historyEntries,
    setEntries: (entries) => {
      historyEntries = entries;
    },
    getPreviews: () => historyPreviews,
    setPreviews: (map) => {
      historyPreviews = map;
    },
    setLoaded: (value) => {
      historyLoaded = value;
    },
    setError: (message) => {
      historyError = message;
    },
    setSaving: (value) => {
      historySaving = value;
    },
    getPreviewImage: () => previewImage,
    setPreviewImage: (image) => {
      previewImage = image;
    },
    getEntryBusy: () => entryBusy,
    setEntryBusy: (ids) => {
      entryBusy = ids;
    },
  });

  const {
    initialize: initializeHistory,
    refreshHistory,
    saveSnapshot,
    clearAllHistory,
    deleteEntry: deleteHistoryEntry,
    loadHistoryImage,
    openPreviewImage,
    closePreviewImage,
    destroy: destroyHistory,
    isStoreLoaded: isHistoryStoreLoaded,
    registerSlotSetter,
  } = historyController;

  const screenshotController = createScreenshotController({
    getLeft: () => left,
    setLeft: (value) => {
      left = value;
    },
    getRight: () => right,
    setRight: (value) => {
      right = value;
    },
    setErrorMessage: (message) => {
      errorMsg = message;
    },
    setInfoMessage: (message) => {
      infoMsg = message;
    },
    clearInfoMessage: () => {
      infoMsg = '';
    },
    setLastError: (value) => {
      lastError = value;
    },
    getRequestTimeout: () => requestTimeoutInput,
    setFetchingLeft: (value) => {
      fetchingLeft = value;
    },
    setFetchingRight: (value) => {
      fetchingRight = value;
    },
    setAutoOpened: (value) => {
      autoOpened = value;
    },
    sanitizeSelector,
    createSlotLabel,
    getCurrentFormState: currentFormState,
    onPersistSlot: async (slotItem) => {
      await saveSnapshot(slotItem);
    },
  });

  const {
    clearSlot,
    resetAll,
    swapSlots,
    addFiles,
    handleChosenFiles,
    fetchScreenshot,
    cancelFetch,
    handlePaste,
    setSlotFromHistory,
    destroy: destroyScreenshots,
  } = screenshotController;

  registerSlotSetter(setSlotFromHistory);

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
    setPersistBaseline(next, { persist: true });
    await tick();
    if (urlInputEl) {
      urlInputEl.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      urlInputEl.focus();
    }
  }

  function dismissError() {
    errorMsg = '';
    lastError = null;
  }

  function dismissInfo() {
    infoMsg = '';
  }

  onMount(() => {
    loadInitialFormState();
    initializeHistory();
    if (!isHistoryStoreLoaded()) {
      void refreshHistory();
    }
  });

  onDestroy(() => {
    destroyHistory();
    destroyScreenshots();
  });

  $effect(() => {
    if (ready && !showDiff && !autoOpened) {
      showDiff = true;
      autoOpened = true;
    }
  });
</script>

<svelte:window onpaste={handlePaste} />

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
    onClearLeft={() => clearSlot('left')}
    onClearRight={() => clearSlot('right')}
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
    onDeleteEntry={(entry) => deleteHistoryEntry(entry)}
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
