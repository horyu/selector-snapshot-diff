export function debounce<F extends (...args: unknown[]) => void>(
  fn: F,
  wait = 120
) {
  let t: number | undefined;
  return (...args: Parameters<F>) => {
    if (t !== undefined) clearTimeout(t);
    t = window.setTimeout(() => {
      t = undefined;
      fn(...args);
    }, wait);
  };
}
