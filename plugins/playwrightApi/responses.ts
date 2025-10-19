import type { ServerResponse } from 'http';
import type { ErrorBody, ErrorCode } from './types';

export function sendJson(
  res: ServerResponse,
  status: number,
  body: Record<string, unknown>
): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export function sendError(
  res: ServerResponse,
  status: number,
  code: ErrorCode,
  error: string,
  extras?: Partial<Pick<ErrorBody, 'message' | 'stack'>>
): void {
  const body: ErrorBody = {
    ok: false,
    code,
    error,
    ...(extras?.message ? { message: extras.message } : {}),
    ...(extras?.stack ? { stack: extras.stack } : {}),
  };
  sendJson(res, status, body);
}
