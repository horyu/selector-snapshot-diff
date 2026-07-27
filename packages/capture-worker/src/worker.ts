import {
  createCapturer,
  SelectorNotFoundError,
} from '@selector-snapshot-diff/capture-core';
import type { ScreenshotPayload } from '@selector-snapshot-diff/protocol/screenshot';
import { chromium } from 'playwright';

const capture = createCapturer({ browser: chromium });
let completed = false;

process.once('disconnect', () => {
  if (!completed) process.exit(1);
});

process.once('message', async (payload: ScreenshotPayload) => {
  try {
    const buffer = await capture(payload);
    process.send?.({ type: 'result', buffer });
  } catch (error) {
    process.send?.({
      type: 'error',
      code:
        error instanceof SelectorNotFoundError
          ? 'selector_not_found'
          : error instanceof Error && error.name === 'TimeoutError'
            ? 'playwright_timeout'
            : 'capture_failed',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
  } finally {
    completed = true;
    process.disconnect?.();
  }
});
