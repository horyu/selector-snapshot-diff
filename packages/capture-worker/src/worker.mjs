import { chromium } from 'playwright';
import {
  createCapturer,
  SelectorNotFoundError,
} from '@selector-snapshot-diff/capture-core';

const capture = createCapturer({ browser: chromium });

process.once('message', async (payload) => {
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
    process.disconnect?.();
  }
});
