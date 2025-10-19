import type { LaunchOptions, Page } from 'playwright';
import type { ScreenshotPayload } from './types';

export type CaptureHooks = {
  /**
   * Invoked before launching the Playwright browser.
   * Use this hook to adjust launch options (e.g. add args, enable devtools).
   */
  prepareBrowser?: (
    launchOptions: LaunchOptions,
    payload: ScreenshotPayload
  ) => Promise<void> | void;
  /**
   * Invoked after a page is created.
   * Default implementation navigates to the target URL and waits for selectors.
   */
  preparePage?: (
    page: Page,
    payload: ScreenshotPayload,
    timeout: number
  ) => Promise<void> | void;
  /**
   * Called right before taking the screenshot.
   * Use this to tweak DOM state (scrolling, highlighting, etc.).
   */
  beforeCapture?: (
    page: Page,
    payload: ScreenshotPayload,
    timeout: number
  ) => Promise<void> | void;
  /**
   * Called after a screenshot buffer is produced.
   * You can return a new Buffer to override the image.
   */
  afterCapture?: (
    page: Page,
    payload: ScreenshotPayload,
    buffer: Buffer
  ) => Promise<Buffer | void> | Buffer | void;
};

export const defaultHooks: Required<CaptureHooks> = {
  async prepareBrowser() {
    return;
  },
  async preparePage(page, payload, timeout) {
    await page.goto(payload.url, { waitUntil: 'load', timeout });
    const waitFor = payload.waitFor?.trim();
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout });
    }
  },
  async beforeCapture() {
    return;
  },
  async afterCapture() {
    return;
  },
};

export function mergeHooks(hooks?: CaptureHooks): Required<CaptureHooks> {
  if (!hooks) return defaultHooks;
  return {
    prepareBrowser: hooks.prepareBrowser ?? defaultHooks.prepareBrowser,
    preparePage: hooks.preparePage ?? defaultHooks.preparePage,
    beforeCapture: hooks.beforeCapture ?? defaultHooks.beforeCapture,
    afterCapture: hooks.afterCapture ?? defaultHooks.afterCapture,
  };
}
