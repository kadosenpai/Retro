import type { FrameData } from './types';

function asU16(pixels: Uint8Array, count: number): Uint16Array {
  if (pixels.byteOffset % 2 === 0) return new Uint16Array(pixels.buffer, pixels.byteOffset, count);
  return new Uint16Array(pixels.slice(0, count * 2).buffer);
}

/** Dạng 16 bit RGB565 sẵn sàng đưa lên GPU (0RGB1555 được đổi sang 565). */
export function to565(f: FrameData): Uint16Array {
  const n = f.width * f.height;
  const src = asU16(f.pixels, n);
  if (f.format === 2) return src;
  const out = new Uint16Array(n);
  for (let i = 0; i < n; i++) {
    const v = src[i];
    const r = (v >> 10) & 31;
    const g = (v >> 5) & 31;
    const b = v & 31;
    out[i] = (r << 11) | (((g << 1) | (g >> 4)) << 5) | b;
  }
  return out;
}

/** Đổi mọi định dạng sang RGBA 8 bit (dùng cho Canvas 2D dự phòng). */
export function toRGBA(f: FrameData, reuse?: Uint8ClampedArray): Uint8ClampedArray {
  const n = f.width * f.height;
  const out = reuse && reuse.length === n * 4 ? reuse : new Uint8ClampedArray(n * 4);
  if (f.format === 1) {
    const s = f.pixels; // XRGB8888 little-endian: B, G, R, X
    for (let i = 0; i < n; i++) {
      out[i * 4] = s[i * 4 + 2];
      out[i * 4 + 1] = s[i * 4 + 1];
      out[i * 4 + 2] = s[i * 4];
      out[i * 4 + 3] = 255;
    }
    return out;
  }
  const src = asU16(f.pixels, n);
  for (let i = 0; i < n; i++) {
    const v = src[i];
    let r: number, g: number, b: number;
    if (f.format === 2) {
      r = ((v >> 11) & 31) << 3;
      g = ((v >> 5) & 63) << 2;
      b = (v & 31) << 3;
    } else {
      r = ((v >> 10) & 31) << 3;
      g = ((v >> 5) & 31) << 3;
      b = (v & 31) << 3;
    }
    out[i * 4] = r | (r >> 5);
    out[i * 4 + 1] = g | (g >> 6);
    out[i * 4 + 2] = b | (b >> 5);
    out[i * 4 + 3] = 255;
  }
  return out;
}
