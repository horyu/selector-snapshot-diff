import { fork } from 'node:child_process';
import { createReadStream, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseScreenshotPayload } from '@selector-snapshot-diff/protocol/screenshot';

const directory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(directory, '../../..');
const workerPath = resolve(
  workspaceRoot,
  'packages/capture-worker/src/worker.mjs'
);
const distPath = resolve(workspaceRoot, 'dist');
const port = Number(process.env.CAPTURE_PORT ?? 5174);
const contentTypes = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const sendJson = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const readBody = (req) =>
  new Promise((resolveBody, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error('Request body too large'));
    });
    req.once('end', () => resolveBody(body));
    req.once('aborted', () => reject(new Error('Request aborted')));
    req.once('error', reject);
  });

const runCapture = (payload, req, res) =>
  new Promise((resolveCapture) => {
    const child = fork(workerPath, [], {
      serialization: 'advanced',
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
    });
    let timedOut = false;
    const timeout = setTimeout(
      () => {
        timedOut = true;
        child.kill();
      },
      (payload.timeout ?? 15000) + 1000
    );
    let settled = false;
    const finish = (fn) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      req.off('aborted', abort);
      res.off('close', abort);
      fn();
      resolveCapture();
    };
    const abort = () => child.kill();

    req.once('aborted', abort);
    res.once('close', abort);
    child.once('message', (message) => {
      if (message?.type === 'result') {
        finish(() => {
          if (!res.writableEnded) {
            res.writeHead(200, {
              'content-type': 'image/png',
              'cache-control': 'no-store',
            });
            res.end(message.buffer);
          }
        });
        return;
      }
      if (message?.type === 'error') {
        finish(() => {
          if (!res.writableEnded) {
            const status =
              message.code === 'selector_not_found'
                ? 404
                : message.code === 'playwright_timeout'
                  ? 504
                  : 500;
            sendJson(res, status, {
              ok: false,
              code: message.code,
              error: message.message,
              message: message.message,
              stack: message.stack,
            });
          }
        });
      }
    });
    child.once('exit', () => {
      finish(() => {
        if (!res.writableEnded && !res.destroyed) {
          sendJson(res, timedOut ? 504 : 500, {
            ok: false,
            code: timedOut ? 'playwright_timeout' : 'capture_failed',
            error: timedOut
              ? 'Capture timed out'
              : 'Capture worker exited unexpectedly',
          });
        }
      });
    });
    child.send(payload);
  });

const serveStatic = (req, res) => {
  const requestPath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
  const target = resolve(distPath, `.${requestPath}`);
  const relativeTarget = relative(distPath, target);
  const safeTarget =
    !relativeTarget.startsWith('..') && !relativeTarget.includes(':')
      ? target
      : join(distPath, 'index.html');
  const file = existsSync(safeTarget)
    ? safeTarget
    : join(distPath, 'index.html');
  if (!existsSync(file)) {
    sendJson(res, 404, {
      error: 'Build output not found. Run pnpm build first.',
    });
    return;
  }
  res.writeHead(200, {
    'content-type': contentTypes[extname(file)] ?? 'application/octet-stream',
  });
  createReadStream(file).pipe(res);
};

const server = createServer(async (req, res) => {
  if (req.url === '/api/screenshot') {
    if (req.method !== 'POST')
      return sendJson(res, 405, {
        ok: false,
        code: 'method_not_allowed',
        error: 'Use POST',
      });
    try {
      const raw = await readBody(req);
      const parsed = parseScreenshotPayload(raw ? JSON.parse(raw) : {});
      if (!parsed.ok)
        return sendJson(res, 400, {
          ok: false,
          code: 'invalid_payload',
          error: parsed.message,
        });
      await runCapture(parsed.value, req, res);
    } catch (error) {
      if (!res.writableEnded)
        sendJson(res, 400, {
          ok: false,
          code: 'invalid_payload',
          error: error instanceof Error ? error.message : 'Invalid request',
        });
    }
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD')
    return sendJson(res, 405, { error: 'Use GET' });
  serveStatic(req, res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Capture gateway listening on http://127.0.0.1:${port}`);
});
