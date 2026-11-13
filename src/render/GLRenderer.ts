import { to565 } from './pixelConvert';
import { computeViewport } from './Scaler';
import { fragmentSource, vertexSource } from './shaders/passthrough';
import { DEFAULT_RENDER_OPTIONS, sanitizeRenderOptions } from './types';
import type { AnyCanvas, FrameData, RenderOptions, Renderer } from './types';

export class GLRenderer implements Renderer {
  readonly kind = 'webgl' as const;
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private texture: WebGLTexture;
  private uBgr: WebGLUniformLocation | null;
  private uTexSize: WebGLUniformLocation | null;
  private uScale: WebGLUniformLocation | null;
  private uMode: WebGLUniformLocation | null;
  private opts: RenderOptions;
  private texKey = '';
  private srcW = 0;
  private srcH = 0;
  private hasFrame = false;

  constructor(
    private readonly canvas: AnyCanvas,
    opts: RenderOptions = DEFAULT_RENDER_OPTIONS,
  ) {
    this.opts = sanitizeRenderOptions(opts);
    const attrs: WebGLContextAttributes = {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'high-performance',
      desynchronized: true,
    };
    const c = canvas as HTMLCanvasElement;
    const gl = (c.getContext('webgl2', attrs) ?? c.getContext('webgl', attrs)) as
      | WebGLRenderingContext
      | null;
    if (!gl) throw new Error('WebGL không khả dụng');
    this.gl = gl;

    this.program = this.link(vertexSource, fragmentSource);
    gl.useProgram(this.program);
    this.uBgr = gl.getUniformLocation(this.program, 'uBgr');
    this.uTexSize = gl.getUniformLocation(this.program, 'uTexSize');
    this.uScale = gl.getUniformLocation(this.program, 'uScale');
    this.uMode = gl.getUniformLocation(this.program, 'uMode');

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(this.program, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    if (!tex) throw new Error('Không tạo được texture');
    this.texture = tex;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    this.applyTextureFilter();
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }

  private static readonly MODE: Record<string, number> = { sharp: 0, smooth: 1, crisp: 2, lcd: 3, crt: 4 };

  /** Chỉ chế độ "sharp" dùng lấy mẫu gần nhất; các chế độ khác cần lấy mẫu tuyến tính. */
  private applyTextureFilter(): void {
    const gl = this.gl;
    const f = this.opts.filter === 'sharp' ? gl.NEAREST : gl.LINEAR;
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
  }

  setOptions(opts: Partial<RenderOptions>): void {
    this.opts = sanitizeRenderOptions({ ...this.opts, ...opts });
    this.applyTextureFilter();
    this.paint();
  }

  private link(vs: string, fs: string): WebGLProgram {
    const gl = this.gl;
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) throw new Error('Không tạo được shader');
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error('Lỗi shader: ' + gl.getShaderInfoLog(s));
      }
      return s;
    };
    const p = gl.createProgram();
    if (!p) throw new Error('Không tạo được program');
    gl.attachShader(p, compile(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Lỗi liên kết shader: ' + gl.getProgramInfoLog(p));
    }
    return p;
  }

  resize(width: number, height: number): void {
    if (width <= 0 || height <= 0) return;
    this.canvas.width = width;
    this.canvas.height = height;
    this.paint();
  }

  draw(frame: FrameData): void {
    const gl = this.gl;
    const rgba = frame.format === 1;
    const key = `${frame.width}x${frame.height}:${rgba ? 'rgba' : '565'}`;
    const format = rgba ? gl.RGBA : gl.RGB;
    const type = rgba ? gl.UNSIGNED_BYTE : gl.UNSIGNED_SHORT_5_6_5;
    const data = rgba ? frame.pixels : to565(frame);

    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    if (key !== this.texKey) {
      gl.texImage2D(gl.TEXTURE_2D, 0, format, frame.width, frame.height, 0, format, type, data);
      this.texKey = key;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, frame.width, frame.height, format, type, data);
    }
    gl.uniform1f(this.uBgr, rgba ? 1 : 0);
    this.srcW = frame.width;
    this.srcH = frame.height;
    this.hasFrame = true;
    this.paint();
  }

  private paint(): void {
    if (!this.hasFrame) return;
    const gl = this.gl;
    const cw = gl.drawingBufferWidth;
    const ch = gl.drawingBufferHeight;
    const vp = computeViewport(cw, ch, this.srcW, this.srcH, this.opts.scale);
    gl.uniform2f(this.uTexSize, this.srcW, this.srcH);
    gl.uniform1f(this.uScale, vp.height / this.srcH);
    gl.uniform1f(this.uMode, GLRenderer.MODE[this.opts.filter] ?? 2);
    gl.viewport(0, 0, cw, ch);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.viewport(vp.x, ch - vp.y - vp.height, vp.width, vp.height);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }
}
