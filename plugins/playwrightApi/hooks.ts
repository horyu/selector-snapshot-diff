/* eslint-disable @typescript-eslint/no-unused-vars */
import type { CaptureHooks } from './types';

// Hooks をカスタマイズしたい場合はこの globalCaptureHooks を直接編集してください。
// アプリ全体で共通の前処理・後処理を追加するための拡張ポイントです。
export const globalCaptureHooks: Required<CaptureHooks> = {
  async prepareBrowser(_launchOptions, _payload) {
    return;
  },
  async preparePage(page, payload, timeout) {
    await page.goto(payload.url, { waitUntil: 'load', timeout });
    const waitFor = payload.waitFor?.trim();
    if (waitFor) {
      await page.waitForSelector(waitFor, { timeout });
    }
  },
  async beforeCapture(_page, _payload, _timeout) {
    return;
  },
  async afterCapture(_page, _payload, buffer) {
    return buffer;
  },
};
