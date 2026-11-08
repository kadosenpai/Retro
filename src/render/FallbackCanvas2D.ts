import { toRGBA } from './pixelConvert';
import { computeViewport } from './Scaler';
import type { AnyCanvas, FrameData, RenderOptions, Renderer } from './types';

type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
type Surface = HTMLCanvasElement | OffscreenCanvas;

/** Dự phòng khi không có WebGL. Chậm hơn WebGL nhưng chạy ở mọi nơi. */
export class FallbackCanvas2D implements Renderer {
  readonly kind = 'canvas2d' as const;
  private ctx: Ctx2D;
  private src: Surface;
  private srcCtx: Ctx2D;
  private rgba: Uint8ClampedArray | undefined;
  private hasFrame = false;

  constructor(
    private readonly canvas: AnyCanvas,
    private readonly opts: RenderOptions = { integerScale: true },
  ) {
    const ctx = (canvas as HTMLCanvasElement).getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas 2D không khả dụng');
    this.ctx = ctx;
    this.src =
      typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1) : document.createElement('canvas');
    const sctx = (this.src as HTMLCanvasElement).getContext('2d');
    if (!sctx) throw new Error('Canvas 2D không khả dụng');
    this.srcCtx = sctx;
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.paint();
  }

  draw(frame: FrameData): void {
    if (this.src.width !== frame.width || this.src.height !== frame.height) {
      this.src.width = frame.width;
      this.src.height = frame.height;
    }
    this.rgba = toRGBA(frame, this.rgba);
    const img = new ImageData(this.rgba as Uint8ClampedArray<ArrayBuffer>, frame.width, frame.height);
    this.srcCtx.putImageData(img, 0, 0);
    this.hasFrame = true;
    this.paint();
  }

  private paint(): void {
    if (!this.hasFrame) return;
    const { width: cw, height: ch } = this.canvas;
    const vp = computeViewport(cw, ch, this.src.width, this.src.height, this.opts.aspect, this.opts.integerScale);
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, cw, ch);
    ctx.drawImage(this.src as CanvasImageSource, 0, 0, this.src.width, this.src.height, vp.x, vp.y, vp.width, vp.height);
  }
}
