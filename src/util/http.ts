export async function parseErrorResponse(
  res: Response
): Promise<{ message: string; stack?: string }> {
  let txt: string;
  try {
    txt = await res.text();
  } catch {
    return { message: res.statusText };
  }
  let message = txt || res.statusText;
  let stack: string | undefined;
  let j: unknown = null;
  try {
    j = txt ? JSON.parse(txt) : null;
  } catch {
    /* ignore parse error */
  }
  if (j && typeof j === 'object') {
    const obj = j as Record<string, unknown>;
    if (typeof obj.message === 'string') message = obj.message;
    if (!message && typeof obj.error === 'string') message = obj.error;
    if (typeof obj.stack === 'string') stack = obj.stack;
  }
  return { message, stack };
}
