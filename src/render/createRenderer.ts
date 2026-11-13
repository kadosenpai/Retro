import { FallbackCanvas2D } from './FallbackCanvas2D';
import { GLRenderer } from './GLRenderer';
import { DEFAULT_RENDER_OPTIONS, type AnyCanvas, type RenderOptions, type Renderer } from './types';

/** Ưu tiên WebGL, không được thì dùng Canvas 2D. */
export function createRenderer(
  canvas: AnyCanvas,
  opts: RenderOptions = DEFAULT_RENDER_OPTIONS,
): Renderer {
  try {
    return new GLRenderer(canvas, opts);
  } catch (e) {
    console.warn('WebGL thất bại, chuyển sang Canvas 2D:', e);
    return new FallbackCanvas2D(canvas, opts);
  }
}
