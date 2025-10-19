import type {
  PlaywrightFormState,
  ScreenshotPayload,
} from '../history/history';

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

export function buildScreenshotPayload({
  url,
  selector,
  args,
  ua,
  vw,
  vh,
  waitFor,
  colorScheme,
}: PlaywrightInputs): ScreenshotPayload {
  const parsedArgs = args
    .split(/\r?\n/)
    .map((t) => t.trim())
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
  if (
    colorScheme === 'light' ||
    colorScheme === 'dark' ||
    colorScheme === 'no-preference'
  ) {
    payload.colorScheme = colorScheme;
  }
  return payload;
}
