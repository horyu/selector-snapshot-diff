import type { ScreenshotPayload, Result } from './types';
import { parseScreenshotPayload } from '../../src/domain/playwright/screenshotSchema';

export function parsePayload(raw: string): Result<ScreenshotPayload> {
  try {
    const obj = raw ? (JSON.parse(raw) as unknown) : {};
    const parsed = parseScreenshotPayload(obj);
    if (!parsed.ok) {
      return { ok: false, error: parsed.message };
    }
    return { ok: true, value: parsed.value };
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }
}
