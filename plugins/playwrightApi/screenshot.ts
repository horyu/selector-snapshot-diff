import { chromium } from 'playwright';
import type {
  Browser,
  BrowserContextOptions,
  ElementHandle,
  LaunchOptions,
} from 'playwright';
import type {
  AbortCheck,
  CaptureDependencies,
  CaptureOptions,
  ScreenshotCapturer,
  ScreenshotPayload,
} from './types';
import { SelectorNotFoundError } from './errors';
import { globalCaptureHooks } from './hooks';

export const DEFAULT_TIMEOUT_MS = 15000;

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

export function createScreenshotCapturer({
  browser,
}: CaptureDependencies): ScreenshotCapturer {
  const hooks = globalCaptureHooks;

  return async (
    payload: ScreenshotPayload,
    options: CaptureOptions = {}
  ): Promise<Buffer | null> => {
    const shouldAbort = ensureAbortCheck(options.shouldAbort);
    const timeout =
      options.timeoutMs ??
      (typeof payload.timeout === 'number'
        ? payload.timeout
        : DEFAULT_TIMEOUT_MS);

    let launchedBrowser: Browser | null = null;

    try {
      const launchOptions: LaunchOptions = {
        headless: true,
      };
      if (payload.args?.length) {
        launchOptions.args = payload.args;
      }
      await hooks.prepareBrowser(launchOptions, payload);
      if (await checkAbort(shouldAbort)) return null;

      launchedBrowser = await browser.launch(launchOptions);
      if (await checkAbort(shouldAbort)) return null;

      const contextOptions: BrowserContextOptions = {};
      if (payload.userAgent) contextOptions.userAgent = payload.userAgent;
      if (payload.viewport) contextOptions.viewport = payload.viewport;
      if (payload.colorScheme) contextOptions.colorScheme = payload.colorScheme;

      const context = await launchedBrowser.newContext(contextOptions);
      const page = await context.newPage();

      await hooks.preparePage(page, payload, timeout);
      if (await checkAbort(shouldAbort)) return null;

      await hooks.beforeCapture(page, payload, timeout);
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
      const modified = await hooks.afterCapture(page, payload, buffer);
      if (modified instanceof Buffer) {
        buffer = modified;
      }
      return buffer;
    } finally {
      if (launchedBrowser) {
        try {
          await launchedBrowser.close();
        } catch {
          /* ignore close errors */
        }
      }
    }
  };
}

export const captureElementScreenshot = createScreenshotCapturer({
  browser: chromium,
});
