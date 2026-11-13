import type { PixelFormat } from '../engine/protocol';

export interface FrameData {
  width: number;
  height: number;
  format: PixelFormat;
  pixels: Uint8Array;
}

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

/**
 * Cách co giãn hình trong vùng hiển thị:
 * fit = vừa khung giữ tỉ lệ gốc; integer = chỉ phóng theo số nguyên (pixel đều, có viền đen);
 * fill = kéo giãn lấp đầy; wide = tỉ lệ 4:3.
 */
export type ScaleMode = 'fit' | 'integer' | 'fill' | 'wide';

/** Bộ lọc hình: sharp = pixel thô, smooth = làm mượt, crisp = sắc mượt, lcd = lưới LCD, crt = màn CRT. */
export type FilterMode = 'sharp' | 'smooth' | 'crisp' | 'lcd' | 'crt';

export interface RenderOptions {
  scale: ScaleMode;
  filter: FilterMode;
}

export const DEFAULT_RENDER_OPTIONS: RenderOptions = { scale: 'fit', filter: 'crisp' };

export const SCALE_MODES: ScaleMode[] = ['fit', 'integer', 'fill', 'wide'];
export const FILTER_MODES: FilterMode[] = ['sharp', 'smooth', 'crisp', 'lcd', 'crt'];

export function sanitizeRenderOptions(v: Partial<RenderOptions> | undefined): RenderOptions {
  return {
    scale: SCALE_MODES.includes(v?.scale as ScaleMode) ? (v!.scale as ScaleMode) : DEFAULT_RENDER_OPTIONS.scale,
    filter: FILTER_MODES.includes(v?.filter as FilterMode)
      ? (v!.filter as FilterMode)
      : DEFAULT_RENDER_OPTIONS.filter,
  };
}

export interface Renderer {
  readonly kind: 'webgl' | 'canvas2d';
  /** Đặt kích thước vùng vẽ (pixel thiết bị) và vẽ lại khung cuối nếu có. */
  resize(width: number, height: number): void;
  draw(frame: FrameData): void;
  /** Đổi cách co giãn / bộ lọc, vẽ lại khung cuối nếu có. */
  setOptions(opts: Partial<RenderOptions>): void;
}
