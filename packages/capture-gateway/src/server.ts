import { fork, type ChildProcess } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { dirname, extname, join, relative, resolve } from 'node:path';
import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';
import {
  parseScreenshotPayload,
  type ScreenshotPayload,
} from '@selector-snapshot-diff/protocol/screenshot';

type WorkerMessage =
  | { type: 'result'; buffer: Buffer }
  | {
      type: 'error';
      code: 'selector_not_found' | 'playwright_timeout' | 'capture_failed';
      message: string;
      stack?: string;
    };

const directory = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(directory, '../../..');
for (const filename of ['.env', '.env.local']) {
  const path = resolve(workspaceRoot, filename);
  if (existsSync(path)) loadEnvFile(path);
}
const workerPath = resolve(
  workspaceRoot,
  'packages/capture-worker/src/worker.ts'
);
const distPath = resolve(workspaceRoot, 'dist');
const parsePort = (value: string | undefined, fallback: number): number => {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port <= 65535 ? port : fallback;
};
const port = parsePort(process.env.CAPTURE_PORT, 5174);
const activeWorkers = new Set<ChildProcess>();
let shuttingDown = false;
const contentTypes: Record<string, string> = {
  '.css': 'text/css',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const sendJson = (
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>
): void => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
};

const readBody = (req: IncomingMessage): Promise<string> =>
  new Promise((resolveBody, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > 1_000_000) reject(new Error('Request body too large'));
    });
    req.once('end', () => resolveBody(body));
    req.once('aborted', () => reject(new Error('Request aborted')));
    req.once('error', reject);
  });

const runCapture = (
  payload: ScreenshotPayload,
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> =>
  new Promise((resolveCapture) => {
    const child = fork(workerPath, [], {
      execArgv: [],
      serialization: 'advanced',
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    activeWorkers.add(child);
    let workerOutput = '';
    const appendWorkerOutput = (chunk: Buffer | string) => {
      workerOutput = `${workerOutput}${chunk.toString()}`.slice(-4000);
    };
    child.stdout?.on('data', appendWorkerOutput);
    child.stderr?.on('data', appendWorkerOutput);
    let timedOut = false;
    const timeout = setTimeout(
      () => {
        timedOut = true;
        child.kill();
      },
      (payload.timeout ?? 15000) + 1000
    );
    let settled = false;
    const abort = () => child.kill();
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      req.off('aborted', abort);
      res.off('close', abort);
      fn();
      resolveCapture();
    };

    req.once('aborted', abort);
    res.once('close', abort);
    child.once('message', (message: WorkerMessage) => {
      if (message.type === 'result') {
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
      const status =
        message.code === 'selector_not_found'
          ? 404
          : message.code === 'playwright_timeout'
            ? 504
            : 500;
      finish(() => {
        if (!res.writableEnded) {
          sendJson(res, status, {
            ok: false,
            code: message.code,
            error: message.message,
            message: message.message,
            stack: message.stack,
          });
        }
      });
    });
    child.once('exit', () => {
      activeWorkers.delete(child);
      finish(() => {
        if (!res.writableEnded && !res.destroyed) {
          const output = workerOutput.trim();
          sendJson(res, timedOut ? 504 : 500, {
            ok: false,
            code: timedOut ? 'playwright_timeout' : 'capture_failed',
            error: timedOut
              ? 'Capture timed out'
              : 'Capture worker exited unexpectedly',
            ...(output ? { message: output, stack: output } : {}),
          });
        }
      });
    });
    child.send(payload);
  });

const serveStatic = (req: IncomingMessage, res: ServerResponse): void => {
  const pathname = req.url?.split('?')[0] ?? '/';
  const requestPath = pathname === '/' ? '/index.html' : pathname;
  const target = resolve(distPath, `.${requestPath}`);
  const relativeTarget = relative(distPath, target);
  const safeTarget =
    !relativeTarget.startsWith('..') && !relativeTarget.includes(':')
      ? target
      : join(distPath, 'index.html');
  const file =
    existsSync(safeTarget) && statSync(safeTarget).isFile()
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
  if (shuttingDown) {
    sendJson(res, 503, { error: 'Capture gateway is shutting down' });
    return;
  }
  if (req.url === '/api/screenshot') {
    if (req.method !== 'POST') {
      sendJson(res, 405, {
        ok: false,
        code: 'method_not_allowed',
        error: 'Use POST',
      });
      return;
    }
    try {
      const raw = await readBody(req);
      const parsed = parseScreenshotPayload(raw ? JSON.parse(raw) : {});
      if (!parsed.ok) {
        sendJson(res, 400, {
          ok: false,
          code: 'invalid_payload',
          error: parsed.message,
        });
        return;
      }
      await runCapture(parsed.value, req, res);
    } catch (error) {
      if (!res.writableEnded) {
        sendJson(res, 400, {
          ok: false,
          code: 'invalid_payload',
          error: error instanceof Error ? error.message : 'Invalid request',
        });
      }
    }
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'Use GET' });
    return;
  }
  serveStatic(req, res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Capture gateway listening on http://127.0.0.1:${port}`);
});

const shutdown = (signal: 'SIGINT' | 'SIGTERM'): void => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received; stopping capture gateway`);

  for (const worker of activeWorkers) worker.kill();
  const forceExitTimer = setTimeout(() => {
    for (const worker of activeWorkers) worker.kill('SIGKILL');
    process.exit(1);
  }, 5000);
  forceExitTimer.unref();

  server.close((error) => {
    clearTimeout(forceExitTimer);
    if (error) {
      console.error('Capture gateway shutdown failed', error);
      process.exitCode = 1;
    }
  });
};

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
