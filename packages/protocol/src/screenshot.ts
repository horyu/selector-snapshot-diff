import { z } from 'zod';

export const SCREENSHOT_COLOR_SCHEMES = [
  'light',
  'dark',
  'no-preference',
] as const;
export type ColorScheme = (typeof SCREENSHOT_COLOR_SCHEMES)[number];
export type ScreenshotPayload = {
  url: string;
  selector: string;
  args?: string[];
  userAgent?: string;
  viewport?: { width: number; height: number };
  waitFor?: string;
  colorScheme?: ColorScheme;
  timeout?: number;
};

const clampViewport = (value: number): number =>
  Math.max(1, Math.min(10000, Math.round(value)));

const selectorSchema = z
  .unknown()
  .optional()
  .transform((value) => {
    if (typeof value !== 'string') return 'body';
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : 'body';
  });

const optionalString = (message: string) =>
  z
    .unknown()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return undefined;
      if (typeof value !== 'string') {
        ctx.addIssue({ code: 'custom', message });
        return z.NEVER;
      }
      return value;
    });

const argsSchema = z
  .unknown()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (
      !Array.isArray(value) ||
      value.some((item) => typeof item !== 'string')
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'args must be an array of strings',
      });
      return z.NEVER;
    }
    return value as string[];
  });

const viewportSchema = z
  .unknown()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (typeof value !== 'object' || value === null) {
      ctx.addIssue({ code: 'custom', message: 'viewport must be object' });
      return z.NEVER;
    }
    const { width, height } = value as Record<string, unknown>;
    if (typeof width !== 'number' || typeof height !== 'number') {
      ctx.addIssue({
        code: 'custom',
        message: 'viewport.width/height must be numbers',
      });
      return z.NEVER;
    }
    if (!Number.isFinite(width) || !Number.isFinite(height)) {
      ctx.addIssue({
        code: 'custom',
        message: 'viewport.width/height must be numbers',
      });
      return z.NEVER;
    }
    return { width: clampViewport(width), height: clampViewport(height) };
  });

const colorSchemeSchema = z
  .unknown()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (
      typeof value !== 'string' ||
      !SCREENSHOT_COLOR_SCHEMES.includes(value as ColorScheme)
    ) {
      ctx.addIssue({
        code: 'custom',
        message: 'colorScheme must be one of: light | dark | no-preference',
      });
      return z.NEVER;
    }
    return value as ColorScheme;
  });

const timeoutSchema = z
  .unknown()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'timeout must be a positive number',
      });
      return z.NEVER;
    }
    return Math.round(value);
  });

export const screenshotPayloadSchema = z
  .object({
    url: z.unknown().transform((value, ctx) => {
      if (typeof value !== 'string' || value.length === 0) {
        ctx.addIssue({ code: 'custom', message: 'Missing url' });
        return z.NEVER;
      }
      if (!/^https?:\/\//i.test(value)) {
        ctx.addIssue({
          code: 'custom',
          message: 'url must start with http(s)://',
        });
        return z.NEVER;
      }
      return value;
    }),
    selector: selectorSchema,
    args: argsSchema,
    userAgent: optionalString('userAgent must be string'),
    viewport: viewportSchema,
    waitFor: optionalString('waitFor must be string (CSS selector)'),
    colorScheme: colorSchemeSchema,
    timeout: timeoutSchema,
  })
  .transform((value): ScreenshotPayload => ({
    url: value.url,
    selector: value.selector,
    ...(value.args !== undefined ? { args: value.args } : {}),
    ...(value.userAgent !== undefined ? { userAgent: value.userAgent } : {}),
    ...(value.viewport !== undefined ? { viewport: value.viewport } : {}),
    ...(value.waitFor !== undefined ? { waitFor: value.waitFor } : {}),
    ...(value.colorScheme !== undefined
      ? { colorScheme: value.colorScheme }
      : {}),
    ...(value.timeout !== undefined ? { timeout: value.timeout } : {}),
  }));
export type ScreenshotPayloadParseResult =
  { ok: true; value: ScreenshotPayload } | { ok: false; message: string };

export const invalidPayloadMessage = 'Invalid payload';

export function parseScreenshotPayload(
  input: unknown
): ScreenshotPayloadParseResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, message: 'Body must be JSON object' };
  }
  const result = screenshotPayloadSchema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };
  return {
    ok: false,
    message: result.error.issues[0]?.message ?? invalidPayloadMessage,
  };
}
