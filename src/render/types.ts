import type { PixelFormat } from '../engine/protocol';

export interface FrameData {
  width: number;
  height: number;
  format: PixelFormat;
  pixels: Uint8Array;
}

export type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;

export interface RenderOptions {
  /** Chỉ phóng to theo số nguyên (pixel sắc nét). */
  integerScale: boolean;
  /** Tỉ lệ khung hình hiển thị; mặc định = width / height của khung. */
  aspect?: number;
}

export interface Renderer {
  readonly kind: 'webgl' | 'canvas2d';
  /** Đặt kích thước vùng vẽ (pixel thiết bị) và vẽ lại khung cuối nếu có. */
  resize(width: number, height: number): void;
  draw(frame: FrameData): void;
}
