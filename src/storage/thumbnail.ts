import type { FrameData } from '../render/types';
import { toRGBA } from '../render/pixelConvert';

/** Chuyển một khung hình thô thành ảnh JPEG nhỏ để làm ảnh thu nhỏ cho save state. */
export async function makeThumbnail(frame: FrameData): Promise<Blob | null> {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    const rgba = toRGBA(frame);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(rgba), frame.width, frame.height), 0, 0);
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  } catch {
    return null;
  }
}
