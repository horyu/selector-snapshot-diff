import { parseErrorResponse } from '../../util/http';
import type { ScreenshotPayload } from '../history/history';

export class ScreenshotRequestError extends Error {
  constructor(
    public status: number,
    message: string,
    public stackTrace?: string
  ) {
    super(message);
    this.name = 'ScreenshotRequestError';
  }
}

export class ScreenshotContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScreenshotContentError';
  }
}

export type TimedAbortHandle = {
  controller: AbortController;
  cleanup: () => void;
  didTimeout: () => boolean;
};

export function createTimedAbortController(
  timeoutValue: string
): TimedAbortHandle {
  const controller = new AbortController();
  const ms = Number(timeoutValue);
  let timer: ReturnType<typeof setTimeout> | null = null;
  let triggered = false;

  if (Number.isFinite(ms) && ms > 0) {
    const delay = Math.max(1, Math.round(ms));
    timer = setTimeout(() => {
      triggered = true;
      controller.abort();
    }, delay);
  }

  const cleanup = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    controller,
    cleanup,
    didTimeout: () => triggered,
  };
}

const SCREENSHOT_ENDPOINT = '/api/screenshot';

export async function fetchScreenshotFile(
  payload: ScreenshotPayload,
  signal: AbortSignal
): Promise<File> {
  const res = await fetch(SCREENSHOT_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
    signal,
  });

  if (!res.ok) {
    const { message, stack } = await parseErrorResponse(res);
    throw new ScreenshotRequestError(res.status, message, stack);
  }

  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('image/png')) {
    const txt = await res.text().catch(() => '');
    throw new ScreenshotContentError(
      `取得したレスポンスが画像ではありません: ${txt.slice(0, 200)}`
    );
  }

  const blob = await res.blob();
  return new File([blob], 'screenshot.png', { type: 'image/png' });
}
