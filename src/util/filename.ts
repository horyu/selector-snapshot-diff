// Utility functions for building safe filenames

export function pad(n: number, w = 2): string {
  return String(n).padStart(w, '0');
}

export function timestampYmdHms(d = new Date()): string {
  return (
    d.getFullYear().toString() +
    pad(d.getMonth() + 1) +
    pad(d.getDate()) +
    pad(d.getHours()) +
    pad(d.getMinutes()) +
    pad(d.getSeconds())
  );
}

// Remove characters that are problematic for filenames on common platforms.
// If the result is empty or a reserved device name on Windows, fallback to 'screenshot'.
export function sanitizeName(input: string | undefined | null): string {
  const base = (input ?? '')
    .normalize('NFKC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, '') // control chars
    .replace(/[\\/:*?"<>|]/g, '') // Windows invalid
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, ''); // leading/trailing dots/spaces
  const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;
  return base && !reserved.test(base) ? base : 'screenshot';
}
