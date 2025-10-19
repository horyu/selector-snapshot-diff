import { sanitizeName, timestampYmdHms } from '../../util/filename';

export type CanvasWithData = {
  canvas: HTMLCanvasElement;
  data: ImageData;
};

export type AlignmentResult = {
  width: number;
  height: number;
  base: CanvasWithData;
  overlay: CanvasWithData;
};

export type DiffMaskOptions = {
  threshold: number;
  includeAA: boolean;
  alpha: number;
};

function createCanvasContext(
  width: number,
  height: number
): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2d context not available');
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

const createCanvasWithImage = (
  img: HTMLImageElement,
  width: number,
  height: number,
  offsetX: number,
  offsetY: number
): CanvasWithData => {
  const { canvas, ctx } = createCanvasContext(width, height);
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(img, offsetX, offsetY);
  const data = ctx.getImageData(0, 0, width, height);
  return { canvas, data };
};

export function alignImagesForDiff(
  baseEl: HTMLImageElement | null,
  overlayEl: HTMLImageElement | null,
  dx: number,
  dy: number
): AlignmentResult | null {
  if (!baseEl || !overlayEl) return null;
  const dxI = dx | 0;
  const dyI = dy | 0;
  const minX = Math.min(0, dxI);
  const minY = Math.min(0, dyI);
  const maxX = Math.max(baseEl.naturalWidth, dxI + overlayEl.naturalWidth);
  const maxY = Math.max(baseEl.naturalHeight, dyI + overlayEl.naturalHeight);
  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);
  const base = createCanvasWithImage(baseEl, width, height, -minX, -minY);
  const overlay = createCanvasWithImage(
    overlayEl,
    width,
    height,
    dxI - minX,
    dyI - minY
  );
  return { width, height, base, overlay };
}

export async function createDiffMaskCanvas(
  aligned: AlignmentResult,
  options: DiffMaskOptions
): Promise<HTMLCanvasElement> {
  const { width, height, base, overlay } = aligned;
  const out = new ImageData(width, height);
  const { default: pixelmatch } = await import('pixelmatch');
  pixelmatch(base.data.data, overlay.data.data, out.data, width, height, {
    threshold: Math.max(0, Math.min(1, Math.round(options.threshold) / 255)),
    includeAA: options.includeAA,
    diffMask: true,
    diffColor: [255, 0, 0],
    aaColor: [255, 255, 0],
    alpha: options.alpha,
  });
  const { canvas, ctx } = createCanvasContext(width, height);
  ctx.putImageData(out, 0, 0);
  return canvas;
}

export function createTriptychCanvas(
  aligned: AlignmentResult,
  diffCanvas: HTMLCanvasElement
): HTMLCanvasElement {
  const { canvas: tripCanvas, ctx } = createCanvasContext(
    aligned.width * 3,
    aligned.height
  );
  ctx.clearRect(0, 0, tripCanvas.width, tripCanvas.height);
  ctx.drawImage(aligned.base.canvas, 0, 0);
  ctx.drawImage(aligned.overlay.canvas, aligned.width, 0);
  ctx.drawImage(diffCanvas, aligned.width * 2, 0);
  return tripCanvas;
}

const buildDiffFilename = (leftName: string, rightName: string): string => {
  const ts = timestampYmdHms();
  const left = sanitizeName(leftName || 'screenshot');
  const right = sanitizeName(rightName || 'screenshot');
  return `${ts} [${left}]-[${right}].png`;
};

export function downloadCanvasAsPng(
  canvas: HTMLCanvasElement,
  leftName: string,
  rightName: string
): void {
  const fileName = buildDiffFilename(leftName, rightName);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }, 'image/png');
}
