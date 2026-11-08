import type { GameInfo, PixelFormat } from '../protocol';

/** Các hàm do libretro_shim.c xuất ra (xem core-build/frontend/libretro_shim.c). */
interface CoreModule {
  HEAPU8: Uint8Array;
  HEAP16: Int16Array;
  _malloc(size: number): number;
  _free(ptr: number): void;
  _shim_init(): number;
  _shim_load_game(ptr: number, size: number): number;
  _shim_unload_game(): void;
  _shim_reset(): void;
  _shim_set_input(mask: number): void;
  _shim_run(): void;
  _shim_frame_ptr(): number;
  _shim_frame_width(): number;
  _shim_frame_height(): number;
  _shim_frame_pitch(): number;
  _shim_frame_updated(): number;
  _shim_pixel_format(): number;
  _shim_audio_ptr(): number;
  _shim_audio_frames(): number;
  _shim_fps(): number;
  _shim_sample_rate(): number;
  _shim_sram_size(): number;
  _shim_sram_ptr(): number;
  _shim_state_size(): number;
  _shim_state_save(ptr: number, size: number): number;
  _shim_state_load(ptr: number, size: number): number;
  /** Chỉ có trong bản Wasm build sau khi thêm cheat; bản cũ không có. */
  _shim_cheat_reset?(): void;
  _shim_cheat_set?(index: number, enabled: number, codePtr: number): void;
  stringToUTF8?(s: string, ptr: number, max: number): void;
  lengthBytesUTF8?(s: string): number;
}

export interface RawFrame {
  width: number;
  height: number;
  format: PixelFormat;
  pixels: Uint8Array;
}

/**
 * Thử tải bản Wasm nén (.wasm.gz) và giải nén trong trình duyệt.
 * Trả về undefined nếu không có (khi đó nhân tự tải file .wasm thường).
 */
async function fetchWasmGz(url: string): Promise<ArrayBuffer | undefined> {
  try {
    const res = await fetch(url);
    if (!res.ok) return undefined;
    const buf = await res.arrayBuffer();
    const b = new Uint8Array(buf, 0, 4);
    if (b[0] === 0x1f && b[1] === 0x8b && typeof DecompressionStream !== 'undefined') {
      const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
      return await new Response(stream).arrayBuffer();
    }
    if (b[0] === 0x00 && b[1] === 0x61 && b[2] === 0x73 && b[3] === 0x6d) return buf; // đã là Wasm thô
  } catch {
    /* dùng file .wasm thường */
  }
  return undefined;
}

export class CoreBridge {
  private constructor(private readonly core: CoreModule) {}

  static async create(coreJsUrl: string): Promise<CoreBridge> {
    // Tải bằng fetch + Blob để Vite (chế độ dev) không chen vào file trong /public.
    const res = await fetch(coreJsUrl);
    if (!res.ok) throw new Error(`Không tải được nhân: ${coreJsUrl} (${res.status})`);
    const code = await res.text();
    const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
    try {
      const mod = await import(/* @vite-ignore */ blobUrl);
      const baseUrl = coreJsUrl.replace(/[^/]+$/, '');
      const wasmBinary = await fetchWasmGz(coreJsUrl.replace(/\.js$/, '.wasm.gz'));
      const core = (await mod.default({
        locateFile: (file: string) => baseUrl + file,
        ...(wasmBinary ? { wasmBinary } : {}),
      })) as CoreModule;
      if (!core._shim_init()) throw new Error('shim_init thất bại (sai phiên bản API libretro?)');
      return new CoreBridge(core);
    } finally {
      URL.revokeObjectURL(blobUrl);
    }
  }

  /** sram (nếu có) được nạp vào nhân TRƯỚC khung hình đầu tiên. */
  loadGame(rom: Uint8Array, sram?: Uint8Array): GameInfo {
    const c = this.core;
    const ptr = c._malloc(rom.byteLength);
    if (!ptr) throw new Error('Hết bộ nhớ khi nạp ROM');
    try {
      c.HEAPU8.set(rom, ptr);
      if (!c._shim_load_game(ptr, rom.byteLength)) {
        throw new Error('Nhân từ chối ROM này (sai định dạng hoặc ROM hỏng)');
      }
    } finally {
      c._free(ptr); // nhân đã tự sao chép dữ liệu ROM
    }
    if (sram && sram.byteLength > 0) this.writeSram(sram);
    // Chạy 1 khung để nhân báo kích thước hình thật.
    c._shim_run();
    return {
      width: c._shim_frame_width(),
      height: c._shim_frame_height(),
      fps: c._shim_fps(),
      sampleRate: c._shim_sample_rate(),
      cheats: this.cheatsSupported,
    };
  }

  /** Bản sao SRAM hiện tại (battery save), hoặc null nếu game không có. */
  readSram(): Uint8Array | null {
    const c = this.core;
    const size = c._shim_sram_size();
    const ptr = c._shim_sram_ptr();
    if (!size || !ptr) return null;
    return c.HEAPU8.slice(ptr, ptr + size);
  }

  private writeSram(data: Uint8Array): void {
    const c = this.core;
    const size = c._shim_sram_size();
    const ptr = c._shim_sram_ptr();
    if (!size || !ptr) return;
    c.HEAPU8.set(data.subarray(0, Math.min(size, data.byteLength)), ptr);
  }

  /** Chụp toàn bộ trạng thái giả lập (save state), hoặc null nếu nhân không hỗ trợ. */
  saveState(): Uint8Array | null {
    const c = this.core;
    const size = c._shim_state_size();
    if (!size) return null;
    const ptr = c._malloc(size);
    if (!ptr) throw new Error('Hết bộ nhớ khi lưu state');
    try {
      if (!c._shim_state_save(ptr, size)) return null;
      return c.HEAPU8.slice(ptr, ptr + size);
    } finally {
      c._free(ptr);
    }
  }

  /** Nạp save state. Trả về false nếu nhân từ chối (sai game hoặc dữ liệu hỏng). */
  loadState(data: Uint8Array): boolean {
    const c = this.core;
    const ptr = c._malloc(data.byteLength);
    if (!ptr) throw new Error('Hết bộ nhớ khi nạp state');
    try {
      c.HEAPU8.set(data, ptr);
      return c._shim_state_load(ptr, data.byteLength) === 1;
    } finally {
      c._free(ptr);
    }
  }

  /** Nhân (Wasm) hiện tại có hỗ trợ cheat không. */
  get cheatsSupported(): boolean {
    return typeof this.core._shim_cheat_set === 'function';
  }

  /** Thay toàn bộ danh sách cheat. Mỗi code: các dòng ngăn bằng khoảng trắng/xuống dòng. */
  setCheats(list: { code: string; enabled: boolean }[]): boolean {
    const c = this.core;
    if (!c._shim_cheat_set || !c._shim_cheat_reset) return false;
    c._shim_cheat_reset();
    list.forEach((ch, i) => {
      if (!ch.enabled) return;
      const code = ch.code
        .toUpperCase()
        .split(/[\s+]+/)
        .filter(Boolean)
        .join('+');
      if (!code) return;
      const bytes = new TextEncoder().encode(code + '\0');
      const ptr = c._malloc(bytes.length);
      if (!ptr) return;
      try {
        c.HEAPU8.set(bytes, ptr);
        c._shim_cheat_set!(i, 1, ptr);
      } finally {
        c._free(ptr);
      }
    });
    return true;
  }

  unloadGame(): void {
    this.core._shim_unload_game();
  }

  reset(): void {
    this.core._shim_reset();
  }

  setInput(mask: number): void {
    this.core._shim_set_input(mask >>> 0);
  }

  /** Chạy 1 khung hình. Trả về true nếu có hình mới. */
  runFrame(): boolean {
    this.core._shim_run();
    return this.core._shim_frame_updated() === 1;
  }

  /** PCM int16 stereo của khung vừa chạy (view vào heap Wasm, dùng ngay). */
  audioView(): { pcm: Int16Array; frames: number } {
    const c = this.core;
    const frames = c._shim_audio_frames();
    const start = c._shim_audio_ptr() >> 1;
    return { pcm: c.HEAP16.subarray(start, start + frames * 2), frames };
  }

  /** View trực tiếp vào heap Wasm (không sao chép). Chỉ dùng ngay, trước lần chạy khung kế tiếp. */
  frameView(): RawFrame | null {
    const c = this.core;
    const ptr = c._shim_frame_ptr();
    if (!ptr) return null;
    const height = c._shim_frame_height();
    const pitch = c._shim_frame_pitch();
    return {
      width: c._shim_frame_width(),
      height,
      format: c._shim_pixel_format() as PixelFormat,
      pixels: c.HEAPU8.subarray(ptr, ptr + pitch * height),
    };
  }

  /** Sao chép khung hình hiện tại ra khỏi heap Wasm (heap có thể đổi chỗ khi giãn nở). */
  readFrame(): RawFrame | null {
    const c = this.core;
    const ptr = c._shim_frame_ptr();
    if (!ptr) return null;
    const height = c._shim_frame_height();
    const pitch = c._shim_frame_pitch();
    return {
      width: c._shim_frame_width(),
      height,
      format: c._shim_pixel_format() as PixelFormat,
      pixels: c.HEAPU8.slice(ptr, ptr + pitch * height),
    };
  }
}
