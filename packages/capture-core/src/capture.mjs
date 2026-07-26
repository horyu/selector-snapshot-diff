export const DEFAULT_TIMEOUT_MS = 15000;

export class SelectorNotFoundError extends Error {
  constructor(message = 'Selector not found') {
    super(message);
    this.name = 'SelectorNotFoundError';
  }
}

export const defaultCaptureProfile = Object.freeze({
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

export function createCapturer({ browser, profile = defaultCaptureProfile }) {
  const hooks = { ...defaultCaptureProfile, ...profile };

  return async (payload, { shouldAbort = () => false } = {}) => {
    const timeout = payload.timeout ?? DEFAULT_TIMEOUT_MS;
    let launchedBrowser;

    try {
      const launchOptions = { headless: true };
      if (payload.args?.length) launchOptions.args = payload.args;
      await hooks.prepareBrowser(launchOptions, payload);
      if (await shouldAbort()) return null;

      launchedBrowser = await browser.launch(launchOptions);
      if (await shouldAbort()) return null;

      const context = await launchedBrowser.newContext({
        ...(payload.userAgent ? { userAgent: payload.userAgent } : {}),
        ...(payload.viewport ? { viewport: payload.viewport } : {}),
        ...(payload.colorScheme ? { colorScheme: payload.colorScheme } : {}),
      });
      const page = await context.newPage();

      await hooks.navigate(page, payload, timeout);
      if (await shouldAbort()) return null;
      await hooks.beforeCapture(page, payload, timeout);
      if (await shouldAbort()) return null;

      const element = await page.waitForSelector(payload.selector || 'body', {
        timeout,
      });
      if (!element) throw new SelectorNotFoundError();
      if (await shouldAbort()) return null;

      const buffer = await element.screenshot({ type: 'png' });
      return (await hooks.afterCapture(page, payload, buffer)) ?? buffer;
    } finally {
      await launchedBrowser?.close().catch(() => undefined);
    }
  };
}
