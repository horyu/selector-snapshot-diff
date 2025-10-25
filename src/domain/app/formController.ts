import {
  createSnapshotPersistAction,
  type SnapshotPersistHandle,
} from '../../actions/persistSnapshot';
import {
  defaultFormState,
  clearFormState,
  loadFormState,
  saveFormState,
  type StoredFormState,
} from '../playwright/formState';
import {
  buildShareLink,
  readFormStateFromUrl,
  removeFormStateFromUrl,
} from '../playwright/shareLink';

export type FormControllerDeps = {
  assignFormState: (state: StoredFormState) => void;
  getCurrentFormState: () => StoredFormState;
  focusUrlInput: () => void;
  setInfoMessage: (message: string) => void;
  clearInfoMessage: () => void;
  setErrorMessage: (message: string) => void;
  clearErrorMessage: () => void;
  clearLastError?: () => void;
  tick: () => Promise<void>;
};

export type FormController = {
  persistFormAction: SnapshotPersistHandle<StoredFormState>['action'];
  setPersistBaseline: (
    state: StoredFormState,
    options?: { persist?: boolean }
  ) => void;
  loadInitialState: () => void;
  clearSavedState: () => Promise<void>;
  copyShareLink: () => Promise<void>;
  sanitizeSelector: (value: string) => string;
  createSlotLabel: (url: string, selector: string) => string;
};

const cloneStoredState = (state: StoredFormState): StoredFormState => ({
  ...state,
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

export function createFormController(deps: FormControllerDeps): FormController {
  let lastPersistedState = cloneStoredState(defaultFormState);

  const formStatePersistence = createSnapshotPersistAction<StoredFormState>({
    getSnapshot: deps.getCurrentFormState,
    onPersist: (next) => {
      lastPersistedState = cloneStoredState(next);
      saveFormState(lastPersistedState);
    },
    compare: statesEqual,
    clone: cloneStoredState,
    initial: lastPersistedState,
  });

  const setPersistBaseline = (
    state: StoredFormState,
    options: { persist?: boolean } = {}
  ) => {
    lastPersistedState = cloneStoredState(state);
    formStatePersistence.setBaseline(lastPersistedState);
    if (options.persist) {
      saveFormState(lastPersistedState);
    }
  };

  const applyStateAndBaseline = (
    state: StoredFormState,
    options?: { persist?: boolean }
  ) => {
    deps.assignFormState(state);
    setPersistBaseline(state, options);
  };

  const loadInitialState = () => {
    const storedState = loadFormState();
    applyStateAndBaseline(storedState);

    const queryState = readFormStateFromUrl();
    if (queryState) {
      applyStateAndBaseline(queryState, { persist: true });
      removeFormStateFromUrl();
    }
  };

  const clearSavedState = async () => {
    clearFormState();
    const nextState = cloneStoredState(defaultFormState);
    applyStateAndBaseline(nextState);
    await deps.tick();
    deps.clearInfoMessage();
    deps.clearErrorMessage();
    deps.clearLastError?.();
    deps.focusUrlInput();
  };

  const copyShareLink = async () => {
    const state = deps.getCurrentFormState();
    try {
      const link = buildShareLink(state);
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(link);
      } else if (typeof document !== 'undefined') {
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
      } else {
        throw new Error('Copy requires a browser environment');
      }
      deps.setInfoMessage('フォーム設定の共有リンクをコピーしました。');
      deps.setErrorMessage('');
      deps.clearLastError?.();
    } catch (error) {
      deps.clearInfoMessage();
      const message =
        error instanceof Error
          ? `共有リンクのコピーに失敗しました: ${error.message}`
          : '共有リンクのコピーに失敗しました。';
      deps.setErrorMessage(message);
    }
  };

  const sanitizeSelector = (value: string): string => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : 'body';
  };

  const createSlotLabel = (resourceUrl: string, selector: string): string => {
    try {
      const host = new URL(resourceUrl).hostname || 'page';
      return `${host} ${selector}`;
    } catch {
      return `page ${selector}`;
    }
  };

  return {
    persistFormAction: formStatePersistence.action,
    setPersistBaseline,
    loadInitialState,
    clearSavedState,
    copyShareLink,
    sanitizeSelector,
    createSlotLabel,
  };
}
