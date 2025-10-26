import {
  makeItem,
  revokeItem,
  type ImgSlot,
  type SlotItem,
} from '../slots/slots';
import {
  createTimedAbortController,
  fetchScreenshotFile,
  ScreenshotContentError,
  ScreenshotRequestError,
} from '../playwright/screenshotClient';
import {
  buildScreenshotPayload,
  createFormSnapshot,
} from '../playwright/config';
import {
  defaultFormState,
  type StoredFormState,
} from '../playwright/formState';
import type { SlotSource } from '../history/history';
import {
  validateImageFile,
  formatImageValidationError,
  ACCEPTED_IMAGE_MESSAGE,
} from '../slots/validation';

export type ApiError = { status: number; message: string; stack?: string };

export type ScreenshotControllerDeps = {
  getLeft: () => ImgSlot | null;
  setLeft: (value: ImgSlot | null) => void;
  getRight: () => ImgSlot | null;
  setRight: (value: ImgSlot | null) => void;
  setErrorMessage: (message: string) => void;
  setInfoMessage: (message: string) => void;
  clearInfoMessage: () => void;
  setLastError: (value: ApiError | null) => void;
  getRequestTimeout: () => string;
  setFetchingLeft: (value: boolean) => void;
  setFetchingRight: (value: boolean) => void;
  setAutoOpened: (value: boolean) => void;
  sanitizeSelector: (value: string) => string;
  createSlotLabel: (url: string, selector: string) => string;
  getCurrentFormState: () => StoredFormState;
  onPersistSlot: (slot: SlotItem) => Promise<void> | void;
};

type SetSlotOptions = {
  labelOverride?: string;
  source: SlotSource;
  skipHistoryPersist?: boolean;
};

type FileOrigin = 'upload' | 'paste';

export type ScreenshotController = {
  clearSlot: (slot: 'left' | 'right') => void;
  resetAll: () => void;
  swapSlots: () => void;
  addFiles: (files: FileList | File[], origin: FileOrigin) => void;
  handleChosenFiles: (slot: 'left' | 'right', files: File[]) => void;
  fetchScreenshot: (slot: 'left' | 'right') => Promise<void>;
  cancelFetch: (slot: 'left' | 'right') => void;
  handlePaste: (event: ClipboardEvent) => void;
  setSlotFromHistory: (
    slot: 'left' | 'right',
    file: File,
    options: { label: string; source: SlotSource }
  ) => void;
  destroy: () => void;
};

export function createScreenshotController(
  deps: ScreenshotControllerDeps
): ScreenshotController {
  const abortControllers: Record<'left' | 'right', AbortController | null> = {
    left: null,
    right: null,
  };

  const reportValidationError = (message: string) => {
    deps.setErrorMessage(message);
    deps.setLastError(null);
  };

  const setSlot = (
    slot: 'left' | 'right',
    file: File,
    options: SetSlotOptions
  ) => {
    const base = makeItem(file, {
      labelOverride: options.labelOverride,
      defaultName: 'screenshot.png',
    });
    const item: SlotItem = { ...base, source: options.source };
    if (slot === 'left') {
      revokeItem(deps.getLeft());
      deps.setLeft(item);
    } else {
      revokeItem(deps.getRight());
      deps.setRight(item);
    }
    deps.setErrorMessage('');
    deps.setAutoOpened(false);
    if (options.skipHistoryPersist) {
      return;
    }
    Promise.resolve(deps.onPersistSlot(item)).catch(() => {
      /* history controller reports errors */
    });
  };

  const clearSlot = (slot: 'left' | 'right') => {
    if (slot === 'left') {
      revokeItem(deps.getLeft());
      deps.setLeft(null);
    } else {
      revokeItem(deps.getRight());
      deps.setRight(null);
    }
  };

  const resetAll = () => {
    clearSlot('left');
    clearSlot('right');
    deps.setErrorMessage('');
    deps.setLastError(null);
    deps.setAutoOpened(false);
  };

  const swapSlots = () => {
    const currentLeft = deps.getLeft();
    const currentRight = deps.getRight();
    if (!currentLeft && !currentRight) return;
    deps.setLeft(currentRight);
    deps.setRight(currentLeft);
  };

  const addFile = (
    file: File,
    origin: FileOrigin,
    options: { skipValidation?: boolean } = {}
  ) => {
    if (!options.skipValidation) {
      const validation = validateImageFile(file);
      if (!validation.ok) {
        reportValidationError(formatImageValidationError(validation.error));
        return;
      }
    }
    const target: 'left' | 'right' = !deps.getLeft()
      ? 'left'
      : !deps.getRight()
        ? 'right'
        : 'right';
    setSlot(target, file, { source: { kind: origin } });
  };

  const addFiles = (files: FileList | File[], origin: FileOrigin) => {
    const arr = Array.from(files);
    if (arr.length === 0) {
      reportValidationError(ACCEPTED_IMAGE_MESSAGE);
      return;
    }
    let added = 0;
    let validFound = false;
    for (const file of arr) {
      const validation = validateImageFile(file);
      if (!validation.ok) {
        reportValidationError(formatImageValidationError(validation.error));
        continue;
      }
      validFound = true;
      addFile(file, origin, { skipValidation: true });
      added += 1;
      if (added >= 2) break;
    }
    if (!validFound) {
      reportValidationError(ACCEPTED_IMAGE_MESSAGE);
    }
  };

  const handleChosenFiles = (slot: 'left' | 'right', files: File[]) => {
    let validFound = false;
    for (const file of files) {
      const validation = validateImageFile(file);
      if (!validation.ok) {
        reportValidationError(formatImageValidationError(validation.error));
        continue;
      }
      validFound = true;
      setSlot(slot, file, { source: { kind: 'upload' } });
      return;
    }
    if (!validFound && files.length > 0) {
      reportValidationError(ACCEPTED_IMAGE_MESSAGE);
    }
  };

  const fetchScreenshot = async (slot: 'left' | 'right') => {
    const formInputs = deps.getCurrentFormState();
    const normalizedUrl = formInputs.url.trim();
    if (!normalizedUrl) {
      deps.setErrorMessage('Please enter a URL');
      deps.setLastError(null);
      return;
    }
    const selector = deps.sanitizeSelector(formInputs.selector);

    abortControllers[slot]?.abort();
    const { controller, cleanup, didTimeout } = createTimedAbortController(
      deps.getRequestTimeout()
    );
    abortControllers[slot] = controller;

    deps.clearInfoMessage();
    deps.setErrorMessage('');
    deps.setLastError(null);
    if (slot === 'left') deps.setFetchingLeft(true);
    else deps.setFetchingRight(true);

    try {
      const payload = buildScreenshotPayload({
        ...formInputs,
        url: normalizedUrl,
        selector,
      });
      const formSnapshot = createFormSnapshot(formInputs);

      const file = await fetchScreenshotFile(payload, controller.signal);
      const slotLabel = deps.createSlotLabel(normalizedUrl, selector);
      setSlot(slot, file, {
        labelOverride: slotLabel,
        source: {
          kind: 'playwright',
          payload,
          form: formSnapshot,
        },
      });
    } catch (error) {
      if (controller.signal.aborted) {
        if (didTimeout()) {
          const ms = Number(deps.getRequestTimeout());
          const duration =
            Number.isFinite(ms) && ms > 0
              ? ms
              : Number(defaultFormState.requestTimeout);
          deps.setErrorMessage(`Request timed out (${Math.round(duration)}ms)`);
        } else {
          deps.setErrorMessage('');
        }
        deps.setLastError(null);
      } else if (error instanceof ScreenshotRequestError) {
        deps.setLastError({
          status: error.status,
          message: error.message,
          stack: error.stackTrace,
        });
        deps.setErrorMessage(`API error ${error.status}: ${error.message}`);
      } else if (error instanceof ScreenshotContentError) {
        deps.setErrorMessage(error.message);
        deps.setLastError(null);
      } else {
        deps.setErrorMessage(
          `Network error: ${error instanceof Error ? error.message : String(error)}`
        );
        deps.setLastError(null);
      }
    } finally {
      cleanup();
      if (abortControllers[slot] === controller) {
        abortControllers[slot] = null;
      }
      if (slot === 'left') deps.setFetchingLeft(false);
      else deps.setFetchingRight(false);
    }
  };

  const cancelFetch = (slot: 'left' | 'right') => {
    const controller = abortControllers[slot];
    if (!controller) return;
    controller.abort();
    abortControllers[slot] = null;
    if (slot === 'left') deps.setFetchingLeft(false);
    else deps.setFetchingRight(false);
    deps.setErrorMessage('');
    deps.setLastError(null);
  };

  const handlePaste = (event: ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (!items) return;
    const files: File[] = [];
    for (const item of items) {
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }
    if (files.length > 0) {
      addFiles(files, 'paste');
    }
  };

  const setSlotFromHistory = (
    slot: 'left' | 'right',
    file: File,
    options: { label: string; source: SlotSource }
  ) => {
    setSlot(slot, file, {
      labelOverride: options.label,
      source: options.source,
      skipHistoryPersist: true,
    });
  };

  const destroy = () => {
    for (const key of ['left', 'right'] as const) {
      abortControllers[key]?.abort();
      abortControllers[key] = null;
    }
    clearSlot('left');
    clearSlot('right');
  };

  return {
    clearSlot,
    resetAll,
    swapSlots,
    addFiles,
    handleChosenFiles,
    fetchScreenshot,
    cancelFetch,
    handlePaste,
    setSlotFromHistory,
    destroy,
  };
}
