import type { IncomingMessage, ServerResponse } from 'http';
import type { Plugin } from 'vite';
import { readRequestBody } from './playwrightApi/body';
import {
  normalizePlaywrightError,
  SelectorNotFoundError,
} from './playwrightApi/errors';
import { parsePayload } from './playwrightApi/payload';
import { sendError } from './playwrightApi/responses';
import {
  captureElementScreenshot,
  DEFAULT_TIMEOUT_MS,
} from './playwrightApi/screenshot';

const ROUTE_PATH = '/api/screenshot';

export default function playwrightApi(): Plugin {
  return {
    name: 'playwright-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(
        ROUTE_PATH,
        async (req: IncomingMessage, res: ServerResponse) => {
          let clientClosed = false;

          const markClientClosed = () => {
            clientClosed = true;
          };

          const shouldAbort = () => clientClosed;

          req.once('aborted', markClientClosed);
          res.once('close', () => {
            if (!res.writableEnded) {
              markClientClosed();
            }
          });

          try {
            if (req.method !== 'POST') {
              if (!clientClosed && !res.writableEnded) {
                sendError(res, 405, 'method_not_allowed', 'Use POST');
              }
              return;
            }

            let rawBody: string;
            try {
              rawBody = await readRequestBody(req);
            } catch {
              markClientClosed();
              return;
            }

            const parsed = parsePayload(rawBody);
            if (!parsed.ok) {
              if (!clientClosed && !res.writableEnded) {
                sendError(res, 400, 'invalid_payload', 'Invalid payload', {
                  message: parsed.error,
                });
              }
              return;
            }
            console.dir(parsed.value);

            const payload = parsed.value;
            const buffer = await captureElementScreenshot(payload, {
              timeoutMs: payload.timeout ?? DEFAULT_TIMEOUT_MS,
              shouldAbort,
            });

            if (buffer === null || clientClosed || res.writableEnded) {
              return;
            }

            res.statusCode = 200;
            res.setHeader('Content-Type', 'image/png');
            res.setHeader('Cache-Control', 'no-store');
            res.end(buffer);
          } catch (error) {
            if (clientClosed || res.writableEnded) {
              return;
            }
            if (error instanceof SelectorNotFoundError) {
              sendError(
                res,
                404,
                'selector_not_found',
                error.message || 'Selector not found'
              );
              return;
            }
            const { isTimeout, message, stack } =
              normalizePlaywrightError(error);
            if (isTimeout) {
              sendError(res, 408, 'timeout', 'Timeout', {
                message,
                stack,
              });
            } else {
              sendError(res, 500, 'internal_error', 'Internal error', {
                message,
                stack,
              });
            }
          }
        }
      );
    },
  };
}
