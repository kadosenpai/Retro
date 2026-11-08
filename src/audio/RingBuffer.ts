/**
 * Bộ đệm vòng âm thanh PCM 16 bit stereo (xen kẽ L,R), một bên ghi - một bên đọc.
 * Dùng chung cho Worker (ghi) và AudioWorklet (đọc). Chạy trên SharedArrayBuffer,
 * hoặc trên ArrayBuffer thường khi không có cross-origin isolation.
 *
 * Bố cục: [Int32 x 8 điều khiển][Int16 x (capacity * 2) dữ liệu].
 * Hai chỉ số write/read là bộ đếm tăng dần (tự quay vòng 32 bit), không phải vị trí.
 */
export const CTRL_WORDS = 8;
export const C_WRITE = 0;
export const C_READ = 1;
export const C_UNDERRUN = 2;
export const C_RATE = 3; // tần số mẫu của nhân (Hz)
export const C_RUNNING = 4; // 1 khi đang chạy game (để không đếm underrun lúc tạm dừng)

export function ringByteLength(capacityFrames: number): number {
  return CTRL_WORDS * 4 + capacityFrames * 2 * 2;
}

export class Ring {
  readonly ctrl: Int32Array;
  readonly data: Int16Array;
  readonly mask: number;

  constructor(
    buffer: ArrayBufferLike,
    readonly capacity: number,
  ) {
    if (capacity < 2 || (capacity & (capacity - 1)) !== 0) {
      throw new Error('capacity phải là luỹ thừa của 2');
    }
    this.ctrl = new Int32Array(buffer, 0, CTRL_WORDS);
    this.data = new Int16Array(buffer, CTRL_WORDS * 4, capacity * 2);
    this.mask = capacity - 1;
  }

  /** Số khung (cặp L,R) đang chờ phát. */
  fill(): number {
    return (Atomics.load(this.ctrl, C_WRITE) - Atomics.load(this.ctrl, C_READ)) | 0;
  }

  /** Ghi tối đa `frames` khung; trả về số khung thực sự ghi được (tràn thì bỏ phần dư). */
  write(pcm: Int16Array, frames: number): number {
    const w = Atomics.load(this.ctrl, C_WRITE);
    const r = Atomics.load(this.ctrl, C_READ);
    const free = this.capacity - ((w - r) | 0);
    const n = Math.max(0, Math.min(frames, free));
    if (n === 0) return 0;
    const start = w & this.mask;
    const first = Math.min(n, this.capacity - start);
    this.data.set(pcm.subarray(0, first * 2), start * 2);
    if (n > first) this.data.set(pcm.subarray(first * 2, n * 2), 0);
    Atomics.store(this.ctrl, C_WRITE, (w + n) | 0);
    return n;
  }
}
