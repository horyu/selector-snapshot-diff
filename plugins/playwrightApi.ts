import type { Plugin } from 'vite';
import {
  captureElementScreenshot,
  DEFAULT_TIMEOUT_MS,
} from './playwrightApi/screenshot';
import { createScreenshotRequestHandler } from './playwrightApi/handler';
import type { PlaywrightApiOptions } from './playwrightApi/types';

const ROUTE_PATH = '/api/screenshot';

export default function playwrightApi(
  options: PlaywrightApiOptions = {}
): Plugin {
  const {
    routePath = ROUTE_PATH,
    capture = captureElementScreenshot,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    logger,
  } = options;

  return {
    name: 'playwright-api',
    apply: 'serve',
    configureServer(server) {
      const handler = createScreenshotRequestHandler({
        capture,
        defaultTimeoutMs: timeoutMs,
        logger,
      });
      server.middlewares.use(routePath, handler);
    },
  };
}
