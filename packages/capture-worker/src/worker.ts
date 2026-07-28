import {
  createCapturer,
  SelectorNotFoundError,
} from '@selector-snapshot-diff/capture-core';
import type { ScreenshotPayload } from '@selector-snapshot-diff/protocol/screenshot';
import { chromium } from 'playwright';

type ParentMessage =
  | { type: 'result'; buffer: Buffer }
  | {
      type: 'error';
      code: 'selector_not_found' | 'playwright_timeout' | 'capture_failed';
      message: string;
      stack?: string;
    };

const capture = createCapturer({ browser: chromium });
let completed = false;

if (!process.send) process.exit(1);

const keepAlive = setInterval(() => undefined, 60_000);
process.channel?.ref?.();

process.once('disconnect', () => {
  clearInterval(keepAlive);
  if (!completed) process.exit(1);
});

const sendToParent = (message: ParentMessage): Promise<void> =>
  new Promise((resolve, reject) => {
    if (!process.send) {
      reject(new Error('Capture worker lost its IPC channel'));
      return;
    }
    process.send(message, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

process.once('message', async (payload: ScreenshotPayload) => {
  let message: ParentMessage | undefined;
  try {
    const buffer = await capture(payload);
    message = { type: 'result', buffer };
  } catch (error) {
    message = {
      type: 'error',
      code:
        error instanceof SelectorNotFoundError
          ? 'selector_not_found'
          : error instanceof Error && error.name === 'TimeoutError'
            ? 'playwright_timeout'
            : 'capture_failed',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    };
  } finally {
    try {
      if (message) await sendToParent(message);
    } finally {
      completed = true;
      clearInterval(keepAlive);
      process.disconnect?.();
    }
  }
});
