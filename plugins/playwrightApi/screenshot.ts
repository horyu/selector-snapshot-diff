import { chromium } from 'playwright';
import type {
  Browser,
  BrowserContextOptions,
  ElementHandle,
  LaunchOptions,
} from 'playwright';
import type { ScreenshotPayload } from './types';
import { SelectorNotFoundError } from './errors';
import { mergeHooks, type CaptureHooks } from './hooks';

type AbortCheck = () => boolean | Promise<boolean>;

export const DEFAULT_TIMEOUT_MS = 15000;

export type CaptureOptions = {
  timeoutMs?: number;
  shouldAbort?: AbortCheck;
};

const resolveSelector = (payload: ScreenshotPayload): string => {
  const raw =
    typeof payload.selector === 'string' ? payload.selector.trim() : '';
  return raw.length > 0 ? raw : 'body';
};

const ensureAbortCheck = (fn?: AbortCheck): AbortCheck => {
  if (!fn) return () => false;
  return fn;
};

const checkAbort = async (fn: AbortCheck): Promise<boolean> => {
  try {
    return Boolean(await fn());
  } catch {
    return true;
  }
};

export async function captureElementScreenshot(
  payload: ScreenshotPayload,
  options: CaptureOptions = {},
  hooks?: CaptureHooks
): Promise<Buffer | null> {
  const shouldAbort = ensureAbortCheck(options.shouldAbort);
  const timeout =
    options.timeoutMs ??
    (typeof payload.timeout === 'number'
      ? payload.timeout
      : DEFAULT_TIMEOUT_MS);

  const mergedHooks = mergeHooks(hooks);

  let browser: Browser | null = null;

  try {
    const launchOptions: LaunchOptions = {
      headless: true,
    };
    if (payload.args?.length) {
      launchOptions.args = payload.args;
    }
    await mergedHooks.prepareBrowser(launchOptions, payload);
    if (await checkAbort(shouldAbort)) return null;

    browser = await chromium.launch(launchOptions);
    if (await checkAbort(shouldAbort)) return null;

    const contextOptions: BrowserContextOptions = {};
    if (payload.userAgent) contextOptions.userAgent = payload.userAgent;
    if (payload.viewport) contextOptions.viewport = payload.viewport;
    if (payload.colorScheme) contextOptions.colorScheme = payload.colorScheme;

    const context = await browser.newContext(contextOptions);
    const page = await context.newPage();

    await mergedHooks.preparePage(page, payload, timeout);
    if (await checkAbort(shouldAbort)) return null;

    await mergedHooks.beforeCapture(page, payload, timeout);
    if (await checkAbort(shouldAbort)) return null;

    const selector = resolveSelector(payload);

    let element: ElementHandle<SVGElement | HTMLElement> | null = null;
    try {
      element = await page.waitForSelector(selector, { timeout });
    } catch {
      /* ignore wait errors */
    }
    if (!element) {
      throw new SelectorNotFoundError();
    }
    if (await checkAbort(shouldAbort)) return null;

    let buffer = await element.screenshot({ type: 'png' });
    const modified = await mergedHooks.afterCapture(page, payload, buffer);
    if (modified instanceof Buffer) {
      buffer = modified;
    }
    return buffer;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore close errors */
      }
    }
  }
}
