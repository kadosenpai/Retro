import { AudioEngine } from '../audio/AudioEngine';
import { createRenderer } from '../render/createRenderer';
import { DEFAULT_RENDER_OPTIONS, type RenderOptions, type Renderer } from '../render/types';
import type { CheatEntry, FramePayload, GameInfo, HostToWorker, PixelFormat, WorkerToHost } from './protocol';

export interface HostEvents {
  onFrame?: (f: { width: number; height: number; format: PixelFormat; pixels: ArrayBuffer }) => void;
  onStats?: (s: { fps: number; underruns: number; audioFillMs: number | null }) => void;
  /** SRAM của ROM `key` đã thay đổi: cần ghi xuống kho lưu trữ. */
  onSram?: (key: string, data: ArrayBuffer) => void;
  /** Kết quả saveState: cần ghi xuống kho lưu trữ. */
  onState?: (s: { key: string; slot: number; data: ArrayBuffer; frame: FramePayload | null }) => void;
  /** Kết quả requestSnapshot. */
  onSnapshot?: (key: string, frame: FramePayload | null) => void;
  onNotice?: (message: string) => void;
  onRenderer?: (kind: 'webgl' | 'canvas2d') => void;
  onError?: (message: string) => void;
}

/** Phía luồng chính: tạo Worker và gửi lệnh cho giả lập. */
export class EmulatorHost {
  private worker: Worker;
  private readyResolve?: () => void;
  private loadedResolve?: (info: GameInfo) => void;
  private rejectPending?: (e: Error) => void;
  private stateLoadedResolve?: (ok: boolean) => void;
  private mainRenderer: Renderer | null = null;
  private renderOptions: RenderOptions = { ...DEFAULT_RENDER_OPTIONS };
  private resizeObserver: ResizeObserver | null = null;
  private audio: AudioEngine | null = null;

  constructor(private readonly events: HostEvents = {}) {
    this.worker = new Worker(new URL('./worker/emulator.worker.ts', import.meta.url), {
      type: 'module',
    });
    this.worker.onmessage = (ev: MessageEvent<WorkerToHost>) => this.handle(ev.data);
    this.worker.onerror = (ev) => this.events.onError?.(ev.message || 'Lỗi Worker');
  }

  private post(msg: HostToWorker, transfer: Transferable[] = []): void {
    this.worker.postMessage(msg, transfer);
  }

  private handle(msg: WorkerToHost): void {
    switch (msg.type) {
      case 'ready':
        this.readyResolve?.();
        break;
      case 'renderer':
        this.events.onRenderer?.(msg.kind);
        break;
      case 'loaded':
        this.loadedResolve?.(msg.info);
        break;
      case 'frame':
        if (this.mainRenderer) {
          this.mainRenderer.draw({
            width: msg.width,
            height: msg.height,
            format: msg.format,
            pixels: new Uint8Array(msg.pixels),
          });
        } else {
          this.events.onFrame?.(msg);
        }
        break;
      case 'state':
        this.events.onState?.({ key: msg.key, slot: msg.slot, data: msg.data, frame: msg.frame });
        break;
      case 'snapshot':
        this.events.onSnapshot?.(msg.key, msg.frame);
        break;
      case 'notice':
        this.events.onNotice?.(msg.message);
        break;
      case 'stateLoaded':
        this.stateLoadedResolve?.(msg.ok);
        this.stateLoadedResolve = undefined;
        break;
      case 'sram':
        this.events.onSram?.(msg.key, msg.data);
        break;
      case 'stats':
        this.events.onStats?.({ fps: msg.fps, underruns: msg.underruns, audioFillMs: msg.audioFillMs });
        break;
      case 'error': {
        const err = new Error(msg.message);
        if (this.rejectPending) this.rejectPending(err);
        this.rejectPending = undefined;
        this.events.onError?.(msg.message);
        break;
      }
    }
  }

  /**
   * Gắn canvas hiển thị. Nếu trình duyệt hỗ trợ OffscreenCanvas, việc vẽ nằm hoàn toàn trong Worker;
   * nếu không, hình được gửi về và vẽ ở luồng chính.
   */
  attachCanvas(canvas: HTMLCanvasElement): 'worker' | 'main' {
    let mode: 'worker' | 'main';
    if (typeof canvas.transferControlToOffscreen === 'function') {
      const off = canvas.transferControlToOffscreen();
      this.post({ type: 'renderOptions', options: this.renderOptions });
      this.post({ type: 'attachCanvas', canvas: off }, [off]);
      mode = 'worker';
    } else {
      this.mainRenderer = createRenderer(canvas, this.renderOptions);
      this.events.onRenderer?.(this.mainRenderer.kind);
      mode = 'main';
    }
    this.resizeObserver = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.round(r.width * dpr));
      const height = Math.max(1, Math.round(r.height * dpr));
      if (mode === 'worker') this.post({ type: 'resize', width, height });
      else this.mainRenderer?.resize(width, height);
    });
    this.resizeObserver.observe(canvas);
    return mode;
  }

  /**
   * Bật âm thanh. PHẢI gọi trong một thao tác của người dùng (bấm/chạm/phím), nếu không trình duyệt
   * (nhất là iOS Safari) sẽ không cho phát tiếng.
   */
  async enableAudio(): Promise<'sab' | 'port' | 'unsupported'> {
    if (this.audio) {
      await this.audio.resume();
      return this.audio.attach.transport;
    }
    try {
      const engine = await AudioEngine.create();
      this.audio = engine;
      const a = engine.attach;
      this.post({ type: 'audioAttach', attach: a }, a.transport === 'port' ? [a.port] : []);
      return a.transport;
    } catch (e) {
      console.warn('Không bật được âm thanh:', e);
      return 'unsupported';
    }
  }

  /** Gọi lại ở mỗi thao tác của người dùng để mở khoá nếu AudioContext vẫn bị treo. */
  resumeAudio(): void {
    void this.audio?.resume();
  }

  setVolume(v: number): void {
    this.audio?.setVolume(v);
  }

  init(coreJsUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.readyResolve = resolve;
      this.rejectPending = reject;
      this.post({ type: 'init', coreJsUrl });
    });
  }

  /** Nạp ROM. key + sram: định danh ROM và dữ liệu lưu cũ của nó (nếu có). Cả hai buffer bị chuyển sang Worker. */
  loadRom(rom: ArrayBuffer, opts: { key?: string; sram?: ArrayBuffer; cheats?: CheatEntry[] } = {}): Promise<GameInfo> {
    return new Promise((resolve, reject) => {
      this.loadedResolve = resolve;
      this.rejectPending = reject;
      const transfer: Transferable[] = [rom];
      if (opts.sram) transfer.push(opts.sram);
      this.post({ type: 'loadRom', rom, key: opts.key, sram: opts.sram, cheats: opts.cheats }, transfer);
    });
  }

  /** Lưu state vào ô `slot` của ROM `key` (kết quả đến qua onState). */
  saveState(key: string, slot: number): void {
    this.post({ type: 'saveState', key, slot });
  }

  /** Nạp state. Buffer bị chuyển sang Worker. Trả về false nếu nhân từ chối. */
  loadState(data: ArrayBuffer): Promise<boolean> {
    return new Promise((resolve, reject) => {
      this.stateLoadedResolve = resolve;
      this.rejectPending = reject;
      this.post({ type: 'loadState', data }, [data]);
    });
  }

  /** Đặt tốc độ giả lập (0.25–8, 1 = bình thường). */
  /** Cập nhật cheat đang áp dụng cho game đang chạy. */
  setCheats(list: CheatEntry[]): void {
    this.post({ type: 'cheats', list });
  }

  /** Đổi cách co giãn / bộ lọc hình ảnh. Nhớ giá trị để áp ngay cả khi gọi trước khi gắn canvas. */
  setRenderOptions(opts: Partial<RenderOptions>): void {
    this.renderOptions = { ...this.renderOptions, ...opts };
    this.post({ type: 'renderOptions', options: this.renderOptions });
    this.mainRenderer?.setOptions(this.renderOptions);
  }

  setSpeed(value: number): void {
    this.post({ type: 'speed', value });
  }

  /** Yêu cầu chụp khung hình hiện tại của game `key` (kết quả đến qua onSnapshot). */
  requestSnapshot(key: string): void {
    this.post({ type: 'snapshot', key });
  }

  /** Yêu cầu Worker gửi SRAM nếu có thay đổi (kết quả đến qua onSram). */
  flushSram(): void {
    this.post({ type: 'flushSram' });
  }

  run(): void {
    this.post({ type: 'run' });
  }
  pause(): void {
    this.post({ type: 'pause' });
  }
  reset(): void {
    this.post({ type: 'reset' });
  }
  setInput(mask: number): void {
    this.post({ type: 'input', mask });
  }

  destroy(): void {
    this.resizeObserver?.disconnect();
    this.audio?.close();
    this.post({ type: 'unload' });
    this.worker.terminate();
  }
}
