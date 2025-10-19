import { defaultFormState, type StoredFormState } from './formState';

const QUERY_KEY = 'pw';
const STATE_KEYS = Object.keys(defaultFormState) as Array<
  keyof StoredFormState
>;
const VALID_COLOR_SCHEMES = new Set(['light', 'dark', 'no-preference']);

/**
 * Base64 helpers are intentionally browser-only. Node.js 環境はサポート対象外。
 */
const encodeBase64 = (text: string): string => {
  if (typeof btoa !== 'function') {
    throw new Error('Base64 encoding requires a browser environment (btoa)');
  }
  return btoa(encodeURIComponent(text));
};

const decodeBase64 = (encoded: string): string => {
  if (typeof atob !== 'function') {
    throw new Error('Base64 decoding requires a browser environment (atob)');
  }
  return decodeURIComponent(atob(encoded));
};

const sanitizeState = (raw: Partial<StoredFormState>): StoredFormState => {
  const next: StoredFormState = { ...defaultFormState };
  STATE_KEYS.forEach((key) => {
    const value = raw[key];
    if (typeof value !== 'string') return;
    const trimmed = value.trim();
    if (!trimmed) {
      next[key] = '';
      return;
    }
    if (key === 'colorScheme' && !VALID_COLOR_SCHEMES.has(trimmed)) {
      next[key] = '';
      return;
    }
    next[key] = trimmed;
  });
  return next;
};

const encodeState = (state: StoredFormState): string =>
  encodeBase64(JSON.stringify(state));

const decodeState = (encoded: string): StoredFormState | null => {
  try {
    const parsed = JSON.parse(
      decodeBase64(encoded)
    ) as Partial<StoredFormState>;
    return sanitizeState(parsed);
  } catch {
    return null;
  }
};

export function readFormStateFromUrl(): StoredFormState | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get(QUERY_KEY);
  if (!encoded) return null;
  return decodeState(encoded);
}

export function removeFormStateFromUrl(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  if (!url.searchParams.has(QUERY_KEY)) return;
  url.searchParams.delete(QUERY_KEY);
  const search = url.searchParams.toString();
  const next = url.pathname + (search ? `?${search}` : '') + (url.hash ?? '');
  window.history.replaceState(null, '', next);
}

export function buildShareLink(state: StoredFormState): string {
  if (typeof window === 'undefined') {
    throw new Error('Share links require a browser environment');
  }
  const base = new URL(window.location.origin + window.location.pathname);
  base.searchParams.set(QUERY_KEY, encodeState(state));
  if (window.location.hash) {
    base.hash = window.location.hash;
  }
  return base.toString();
}
