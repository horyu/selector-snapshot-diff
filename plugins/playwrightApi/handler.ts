import type { IncomingMessage, ServerResponse } from 'http';
import { readRequestBody } from './body';
import { parsePayload } from './payload';
import { normalizePlaywrightError, SelectorNotFoundError } from './errors';
import { sendError } from './responses';
import type { CaptureHooks, HandlerLogger, ScreenshotCapturer } from './types';

export type CreateHandlerOptions = {
  capture: ScreenshotCapturer;
  defaultTimeoutMs: number;
  hooks?: CaptureHooks;
  logger?: HandlerLogger;
};

const noop = () => undefined;

export function createScreenshotRequestHandler({
  capture,
  defaultTimeoutMs,
  hooks,
  logger,
}: CreateHandlerOptions) {
  const debug = logger?.debug ?? noop;
  const error = logger?.error ?? noop;

  return async (req: IncomingMessage, res: ServerResponse) => {
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
      } catch (cause) {
        error('Failed to read request body', {
          cause: cause instanceof Error ? cause.message : String(cause),
        });
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

      const payload = parsed.value;
      debug('Received screenshot payload', { url: payload.url });

      const buffer = await capture(
        payload,
        {
          timeoutMs: payload.timeout ?? defaultTimeoutMs,
          shouldAbort,
        },
        hooks
      );

      if (buffer === null || clientClosed || res.writableEnded) {
        return;
      }

      res.statusCode = 200;
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'no-store');
      res.end(buffer);
    } catch (rawError) {
      error('Screenshot request failed', {
        error: rawError instanceof Error ? rawError.message : String(rawError),
      });
      if (clientClosed || res.writableEnded) {
        return;
      }
      if (rawError instanceof SelectorNotFoundError) {
        sendError(
          res,
          404,
          'selector_not_found',
          rawError.message || 'Selector not found'
        );
        return;
      }
      const { isTimeout, message, stack } = normalizePlaywrightError(rawError);
      if (isTimeout) {
        sendError(res, 504, 'playwright_timeout', 'Timeout', {
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
  };
}
