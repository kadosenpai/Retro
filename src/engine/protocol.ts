// Thông điệp giữa luồng chính (Host) và Worker chạy giả lập.
import type { AudioAttach } from '../audio/types';
import type { RenderOptions } from '../render/types';

/** 0 = 0RGB1555, 1 = XRGB8888, 2 = RGB565 (theo enum retro_pixel_format). */
export type PixelFormat = 0 | 1 | 2;

export interface FramePayload {
  width: number;
  height: number;
  format: PixelFormat;
  pixels: ArrayBuffer;
}

export interface GameInfo {
  width: number;
  height: number;
  fps: number;
  sampleRate: number;
  /** Nhân Wasm có hỗ trợ cheat không (bản build cũ thì không). */
  cheats?: boolean;
}

export interface CheatEntry {
  code: string;
  enabled: boolean;
}

export type HostToWorker =
  | { type: 'init'; coreJsUrl: string }
  | { type: 'attachCanvas'; canvas: OffscreenCanvas }
  | { type: 'resize'; width: number; height: number }
  | { type: 'renderOptions'; options: RenderOptions }
  | { type: 'audioAttach'; attach: AudioAttach }
  /** key: định danh ROM (dùng để gắn SRAM trả về); sram: dữ liệu lưu đã có, nạp trước khi chạy. */
  | { type: 'loadRom'; rom: ArrayBuffer; key?: string; sram?: ArrayBuffer; cheats?: CheatEntry[] }
  | { type: 'cheats'; list: CheatEntry[] }
  | { type: 'flushSram' }
  /** Tốc độ giả lập (1 = bình thường). */
  | { type: 'speed'; value: number }
  /** Chụp khung hình hiện tại (làm ảnh bìa). */
  | { type: 'snapshot'; key: string }
  | { type: 'saveState'; key: string; slot: number }
  | { type: 'loadState'; data: ArrayBuffer }
  | { type: 'run' }
  | { type: 'pause' }
  | { type: 'reset' }
  | { type: 'input'; mask: number }
  | { type: 'unload' };

export type WorkerToHost =
  | { type: 'ready' }
  | { type: 'renderer'; kind: 'webgl' | 'canvas2d' }
  | { type: 'loaded'; info: GameInfo }
  | { type: 'frame'; width: number; height: number; format: PixelFormat; pixels: ArrayBuffer }
  /** SRAM đã thay đổi kể từ lần gửi trước; key là khoá của ROM đang chơi lúc đó. */
  | { type: 'sram'; key: string; data: ArrayBuffer }
  /** Kết quả saveState: dữ liệu state + khung hình hiện tại (để làm ảnh thu nhỏ). */
  | { type: 'state'; key: string; slot: number; data: ArrayBuffer; frame: FramePayload | null }
  | { type: 'stateLoaded'; ok: boolean }
  | { type: 'snapshot'; key: string; frame: FramePayload | null }
  /** Thông báo lỗi nhẹ: game vẫn chạy tiếp (vd. lưu state thất bại). */
  | { type: 'notice'; message: string }
  | { type: 'stats'; fps: number; underruns: number; audioFillMs: number | null }
  | { type: 'error'; message: string };
