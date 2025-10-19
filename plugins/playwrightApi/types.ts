export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export type ColorScheme = 'light' | 'dark' | 'no-preference';

export interface ScreenshotPayload {
  url: string;
  selector: string;
  timeout?: number;
  args?: string[];
  userAgent?: string;
  viewport?: { width: number; height: number };
  waitFor?: string;
  colorScheme?: ColorScheme;
}

export type ErrorCode =
  | 'method_not_allowed'
  | 'invalid_payload'
  | 'selector_not_found'
  | 'playwright_timeout'
  | 'internal_error';

export type ErrorBody = {
  ok: false;
  code: ErrorCode;
  error: string;
  message?: string;
  stack?: string;
};
