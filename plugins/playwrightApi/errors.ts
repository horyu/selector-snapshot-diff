export class SelectorNotFoundError extends Error {
  constructor(message = 'Selector not found') {
    super(message);
    this.name = 'SelectorNotFoundError';
  }
}

export type NormalizedError = {
  message: string;
  stack?: string;
  isTimeout: boolean;
};

const ANSI_PATTERN =
  // eslint-disable-next-line no-control-regex
  /[\u001B\u009B][[\]()#;?]*(?:(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]|(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)/g;

const stripAnsi = (value: string) => value.replace(ANSI_PATTERN, '');

export function normalizePlaywrightError(error: unknown): NormalizedError {
  const obj =
    error && typeof error === 'object'
      ? (error as { name?: unknown; message?: unknown; stack?: unknown })
      : undefined;
  const rawName = obj?.name ? String(obj.name) : '';
  const rawMessage =
    obj?.message !== undefined
      ? String(obj.message)
      : typeof error === 'string'
        ? error
        : 'Unknown error';
  const rawStack = obj?.stack ? String(obj.stack) : undefined;

  const message = stripAnsi(rawMessage);
  const stack = rawStack ? stripAnsi(rawStack) : undefined;

  const timeout =
    /timeout/i.test(rawName) || /timed?\s*out/i.test(message) ? true : false;

  return {
    message,
    stack,
    isTimeout: timeout,
  };
}
