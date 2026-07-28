import type { PlaywrightFormState } from '../history/history';
import type { ScreenshotPayload } from './screenshotSchema';

export type PlaywrightInputs = {
  url: string;
  selector: string;
  args: string;
  ua: string;
  vw: string;
  vh: string;
  waitFor: string;
  requestTimeout: string;
  colorScheme: string;
};

export function createFormSnapshot({
  url,
  selector,
  args,
  ua,
  vw,
  vh,
  waitFor,
  requestTimeout,
  colorScheme,
}: PlaywrightInputs): PlaywrightFormState {
  return {
    url,
    selector,
    args,
    ua,
    vw,
    vh,
    waitFor,
    requestTimeout,
    colorScheme,
  };
}

function normalizeChromiumArg(value: string): string {
  return value.replace(/^(--[^=]+=)(["'])(.*)\2$/, '$1$3');
}

export function buildScreenshotPayload({
  url,
  selector,
  args,
  ua,
  vw,
  vh,
  waitFor,
  requestTimeout,
  colorScheme,
}: PlaywrightInputs): ScreenshotPayload {
  const parsedArgs = args
    .split(/\r?\n/)
    .map((t) => t.trim())
    .map(normalizeChromiumArg)
    .filter((t) => t.length > 0);
  const payload: ScreenshotPayload = { url, selector };
  if (parsedArgs.length) payload.args = parsedArgs;
  if (ua.trim()) payload.userAgent = ua.trim();
  const width = Number(vw);
  const height = Number(vh);
  if (
    Number.isFinite(width) &&
    Number.isFinite(height) &&
    width > 0 &&
    height > 0
  ) {
    payload.viewport = {
      width: Math.round(width),
      height: Math.round(height),
    };
  }
  if (waitFor.trim()) payload.waitFor = waitFor.trim();
  const timeout = Number(requestTimeout);
  if (Number.isFinite(timeout) && timeout > 0) {
    payload.timeout = Math.round(timeout);
  }
  if (
    colorScheme === 'light' ||
    colorScheme === 'dark' ||
    colorScheme === 'no-preference'
  ) {
    payload.colorScheme = colorScheme;
  }
  return payload;
}
