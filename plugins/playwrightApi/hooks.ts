import type { CaptureHooks } from './types';

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

export function mergeHooks(
  ...hooksList: Array<CaptureHooks | undefined>
): Required<CaptureHooks> {
  let merged = defaultHooks;
  for (const hooks of hooksList) {
    if (!hooks) continue;
    merged = {
      prepareBrowser: hooks.prepareBrowser ?? merged.prepareBrowser,
      preparePage: hooks.preparePage ?? merged.preparePage,
      beforeCapture: hooks.beforeCapture ?? merged.beforeCapture,
      afterCapture: hooks.afterCapture ?? merged.afterCapture,
    };
  }
  return merged;
}
