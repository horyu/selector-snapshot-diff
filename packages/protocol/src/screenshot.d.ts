import type { z } from 'zod';

export type ColorScheme = 'light' | 'dark' | 'no-preference';
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
export type ScreenshotPayloadParseResult =
  { ok: true; value: ScreenshotPayload } | { ok: false; message: string };
export const SCREENSHOT_COLOR_SCHEMES: readonly ColorScheme[];
export const screenshotPayloadSchema: z.ZodType<ScreenshotPayload>;
export const invalidPayloadMessage: string;
export function parseScreenshotPayload(
  input: unknown
): ScreenshotPayloadParseResult;
