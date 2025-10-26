import type { Browser, BrowserType, LaunchOptions, Page } from 'playwright';
import type {
  ColorScheme as SchemaColorScheme,
  ScreenshotPayload as SchemaScreenshotPayload,
} from '../../src/domain/playwright/screenshotSchema';

export type ColorScheme = SchemaColorScheme;
export type ScreenshotPayload = SchemaScreenshotPayload;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

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
  options?: CaptureOptions
) => Promise<Buffer | null>;

export type CaptureDependencies = {
  browser: BrowserLauncher;
};

export type HandlerLogger = {
  debug?: (message: string, context?: Record<string, unknown>) => void;
  error?: (message: string, context?: Record<string, unknown>) => void;
};

export type PlaywrightApiOptions = {
  routePath?: string;
  capture?: ScreenshotCapturer;
  timeoutMs?: number;
  logger?: HandlerLogger;
};
