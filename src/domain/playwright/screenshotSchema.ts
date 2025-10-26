import { z } from 'zod';

export const SCREENSHOT_COLOR_SCHEMES = [
  'light',
  'dark',
  'no-preference',
] as const;
export type ColorScheme = (typeof SCREENSHOT_COLOR_SCHEMES)[number];

const clampViewport = (value: number): number => {
  return Math.max(1, Math.min(10000, Math.round(value)));
};

const selectorSchema = z
  .unknown()
  .optional()
  .transform((value) => {
    if (typeof value !== 'string') return 'body';
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : 'body';
  });

const argsSchema = z
  .unknown()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (!Array.isArray(value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'args must be an array of strings',
      });
      return z.NEVER;
    }
    for (const item of value) {
      if (typeof item !== 'string') {
        ctx.addIssue({
          code: 'custom',
          message: 'args must be an array of strings',
        });
        return z.NEVER;
      }
    }
    return value as string[];
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

const viewportSchema = z
  .unknown()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (typeof value !== 'object' || value === null) {
      ctx.addIssue({
        code: 'custom',
        message: 'viewport must be object',
      });
      return z.NEVER;
    }
    const candidate = value as Record<string, unknown>;
    const width = candidate.width;
    const height = candidate.height;
    if (typeof width !== 'number' || !Number.isFinite(width)) {
      ctx.addIssue({
        code: 'custom',
        message: 'viewport.width/height must be numbers',
      });
      return z.NEVER;
    }
    if (typeof height !== 'number' || !Number.isFinite(height)) {
      ctx.addIssue({
        code: 'custom',
        message: 'viewport.width/height must be numbers',
      });
      return z.NEVER;
    }
    return {
      width: clampViewport(width),
      height: clampViewport(height),
    };
  });

const colorSchemeSchema = z
  .unknown()
  .optional()
  .transform((value, ctx) => {
    if (value === undefined) return undefined;
    if (typeof value !== 'string') {
      ctx.addIssue({
        code: 'custom',
        message: 'colorScheme must be one of: light | dark | no-preference',
      });
      return z.NEVER;
    }
    if (!SCREENSHOT_COLOR_SCHEMES.includes(value as ColorScheme)) {
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

const baseSchema = z.object({
  url: z.unknown().transform((value, ctx) => {
    if (typeof value !== 'string') {
      ctx.addIssue({ code: 'custom', message: 'Missing url' });
      return z.NEVER;
    }
    if (value.length === 0) {
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
});

type ScreenshotPayloadShape = {
  url: string;
  selector: string;
  args?: string[];
  userAgent?: string;
  viewport?: { width: number; height: number };
  waitFor?: string;
  colorScheme?: ColorScheme;
  timeout?: number;
};

export const screenshotPayloadSchema = baseSchema.transform((value) => {
  const payload = {
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
  } satisfies ScreenshotPayloadShape;
  return payload;
});

export type ScreenshotPayload = z.infer<typeof screenshotPayloadSchema>;

export type ScreenshotPayloadParseResult =
  | { ok: true; value: ScreenshotPayload }
  | { ok: false; message: string };

export const invalidPayloadMessage = 'Invalid payload';

export function parseScreenshotPayload(
  input: unknown
): ScreenshotPayloadParseResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return { ok: false, message: 'Body must be JSON object' };
  }
  const result = screenshotPayloadSchema.safeParse(input);
  if (result.success) {
    return { ok: true, value: result.data };
  }
  const firstIssue = result.error.issues[0];
  const message = firstIssue?.message ?? invalidPayloadMessage;
  return { ok: false, message };
}
