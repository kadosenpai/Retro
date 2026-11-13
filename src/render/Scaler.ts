import type { ScaleMode } from './types';

export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Tính vùng hiển thị trong canvas theo chế độ co giãn; luôn căn giữa. */
export function computeViewport(
  canvasW: number,
  canvasH: number,
  srcW: number,
  srcH: number,
  mode: ScaleMode = 'fit',
): Viewport {
  if (canvasW <= 0 || canvasH <= 0 || srcW <= 0 || srcH <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  if (mode === 'fill') return { x: 0, y: 0, width: canvasW, height: canvasH };

  const aspect = mode === 'wide' ? 4 / 3 : srcW / srcH;
  let scale = Math.min(canvasH / srcH, canvasW / (srcH * aspect));
  if (mode === 'integer' && scale >= 1) scale = Math.floor(scale);
  const width = Math.max(1, Math.round(srcH * aspect * scale));
  const height = Math.max(1, Math.round(srcH * scale));
  return {
    x: Math.floor((canvasW - width) / 2),
    y: Math.floor((canvasH - height) / 2),
    width,
    height,
  };
}
