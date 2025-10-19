import type { ScreenshotPayload, Result, ColorScheme } from './types';

const COLOR_SCHEMES: readonly ColorScheme[] = [
  'light',
  'dark',
  'no-preference',
] as const;

const schemeSet = new Set<ColorScheme>(COLOR_SCHEMES);

export function parsePayload(raw: string): Result<ScreenshotPayload> {
  try {
    const obj = raw ? (JSON.parse(raw) as unknown) : {};
    if (typeof obj !== 'object' || obj === null) {
      return { ok: false, error: 'Body must be JSON object' };
    }
    const {
      url,
      selector,
      args,
      userAgent,
      viewport,
      waitFor,
      colorScheme,
      timeout,
    } = obj as Record<string, unknown>;

    if (typeof url !== 'string') {
      return { ok: false, error: 'Missing url' };
    }
    if (!/^https?:\/\//i.test(url)) {
      return { ok: false, error: 'url must start with http(s)://' };
    }

    const normalizedSelector =
      typeof selector === 'string' && selector.trim().length > 0
        ? selector.trim()
        : 'body';

    let parsedArgs: string[] | undefined;
    if (Array.isArray(args)) {
      for (const value of args) {
        if (typeof value !== 'string') {
          return { ok: false, error: 'args must be an array of strings' };
        }
      }
      parsedArgs = args as string[];
    } else if (args !== undefined) {
      return { ok: false, error: 'args must be an array of strings' };
    }

    let parsedUserAgent: string | undefined;
    if (userAgent !== undefined) {
      if (typeof userAgent !== 'string') {
        return { ok: false, error: 'userAgent must be string' };
      }
      parsedUserAgent = userAgent;
    }

    let parsedViewport: { width: number; height: number } | undefined;
    if (viewport !== undefined) {
      if (typeof viewport !== 'object' || viewport === null) {
        return { ok: false, error: 'viewport must be object' };
      }
      const { width, height } = viewport as Record<string, unknown>;
      if (typeof width !== 'number' || typeof height !== 'number') {
        return { ok: false, error: 'viewport.width/height must be numbers' };
      }
      const clamp = (value: number) =>
        Math.max(1, Math.min(10000, Math.round(value)));
      parsedViewport = { width: clamp(width), height: clamp(height) };
    }

    let parsedWaitFor: string | undefined;
    if (waitFor !== undefined) {
      if (typeof waitFor !== 'string') {
        return { ok: false, error: 'waitFor must be string (CSS selector)' };
      }
      parsedWaitFor = waitFor;
    }

    let parsedColorScheme: ColorScheme | undefined;
    if (colorScheme !== undefined) {
      if (
        typeof colorScheme !== 'string' ||
        !schemeSet.has(colorScheme as ColorScheme)
      ) {
        return {
          ok: false,
          error: 'colorScheme must be one of: light | dark | no-preference',
        };
      }
      parsedColorScheme = colorScheme as ColorScheme;
    }

    let parsedTimeout: number | undefined;
    if (timeout !== undefined) {
      if (
        typeof timeout !== 'number' ||
        !Number.isFinite(timeout) ||
        timeout <= 0
      ) {
        return { ok: false, error: 'timeout must be a positive number' };
      }
      parsedTimeout = Math.round(timeout);
    }

    const payload: ScreenshotPayload = {
      url,
      selector: normalizedSelector,
      ...(parsedArgs ? { args: parsedArgs } : {}),
      ...(parsedUserAgent ? { userAgent: parsedUserAgent } : {}),
      ...(parsedViewport ? { viewport: parsedViewport } : {}),
      ...(parsedWaitFor ? { waitFor: parsedWaitFor } : {}),
      ...(parsedColorScheme ? { colorScheme: parsedColorScheme } : {}),
      ...(parsedTimeout ? { timeout: parsedTimeout } : {}),
    };

    return { ok: true, value: payload };
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
}
