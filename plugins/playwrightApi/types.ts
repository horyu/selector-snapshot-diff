import type { Browser, BrowserType, LaunchOptions, Page } from 'playwright';

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

export type AbortCheck = () => boolean | Promise<boolean>;

export type CaptureOptions = {
  timeoutMs?: number;
  shouldAbort?: AbortCheck;
};

export type BrowserLauncher = Pick<BrowserType<Browser>, 'launch'>;

export type CaptureHooks = {
  prepareBrowser?: (
    launchOptions: LaunchOptions,
    payload: ScreenshotPayload
  ) => Promise<void> | void;
  preparePage?: (
    page: Page,
    payload: ScreenshotPayload,
    timeout: number
  ) => Promise<void> | void;
  beforeCapture?: (
    page: Page,
    payload: ScreenshotPayload,
    timeout: number
  ) => Promise<void> | void;
  afterCapture?: (
    page: Page,
    payload: ScreenshotPayload,
    buffer: Buffer
  ) => Promise<Buffer | void> | Buffer | void;
};

export type ScreenshotCapturer = (
  payload: ScreenshotPayload,
  options?: CaptureOptions,
  hooks?: CaptureHooks
) => Promise<Buffer | null>;

export type CaptureDependencies = {
  browser: BrowserLauncher;
  hooks?: CaptureHooks;
};

export type HandlerLogger = {
  debug?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
};

export type PlaywrightApiOptions = {
  routePath?: string;
  capture?: ScreenshotCapturer;
  hooks?: CaptureHooks;
  timeoutMs?: number;
  logger?: HandlerLogger;
};
