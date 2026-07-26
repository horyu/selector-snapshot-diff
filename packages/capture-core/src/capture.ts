import type { ScreenshotPayload } from '@selector-snapshot-diff/protocol/screenshot';
import type {
  Browser,
  BrowserContextOptions,
  BrowserType,
  LaunchOptions,
  Page,
} from 'playwright';

export const DEFAULT_TIMEOUT_MS = 15000;

export class SelectorNotFoundError extends Error {
  constructor(message = 'Selector not found') {
    super(message);
    this.name = 'SelectorNotFoundError';
  }
}

export type CaptureProfile = {
  prepareBrowser?: (
    launchOptions: LaunchOptions,
    payload: ScreenshotPayload
  ) => Promise<void> | void;
  navigate?: (
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

export const defaultCaptureProfile: Required<CaptureProfile> = Object.freeze({
  async prepareBrowser() {},
  async navigate(page, payload, timeout) {
    await page.goto(payload.url, { waitUntil: 'load', timeout });
    const waitFor = payload.waitFor?.trim();
    if (waitFor) await page.waitForSelector(waitFor, { timeout });
  },
  async beforeCapture() {},
  async afterCapture(_page, _payload, buffer) {
    return buffer;
  },
});

type BrowserLauncher = Pick<BrowserType, 'launch'>;

export function createCapturer({
  browser,
  profile = defaultCaptureProfile,
}: {
  browser: BrowserLauncher;
  profile?: CaptureProfile;
}): (payload: ScreenshotPayload) => Promise<Buffer> {
  const hooks = { ...defaultCaptureProfile, ...profile };

  return async (payload) => {
    const timeout = payload.timeout ?? DEFAULT_TIMEOUT_MS;
    let launchedBrowser: Browser | undefined;

    try {
      const launchOptions: LaunchOptions = { headless: true };
      if (payload.args?.length) launchOptions.args = payload.args;
      await hooks.prepareBrowser(launchOptions, payload);

      launchedBrowser = await browser.launch(launchOptions);

      const contextOptions: BrowserContextOptions = {
        ...(payload.userAgent ? { userAgent: payload.userAgent } : {}),
        ...(payload.viewport ? { viewport: payload.viewport } : {}),
        ...(payload.colorScheme ? { colorScheme: payload.colorScheme } : {}),
      };
      const context = await launchedBrowser.newContext(contextOptions);
      const page = await context.newPage();

      await hooks.navigate(page, payload, timeout);
      await hooks.beforeCapture(page, payload, timeout);

      const element = await page.waitForSelector(payload.selector || 'body', {
        timeout,
      });
      if (!element) throw new SelectorNotFoundError();

      const buffer = await element.screenshot({ type: 'png' });
      return (await hooks.afterCapture(page, payload, buffer)) ?? buffer;
    } finally {
      await launchedBrowser?.close().catch(() => undefined);
    }
  };
}
