import { C_READ, C_RATE, C_RUNNING, C_UNDERRUN, C_WRITE, Ring, ringByteLength } from '../RingBuffer';

// AudioWorkletGlobalScope không có kiểu chuẩn trong TypeScript, nên truy cập qua globalThis.
interface WorkletBase {
  port: MessagePort;
}
const g = globalThis as unknown as {
  AudioWorkletProcessor: new () => WorkletBase;
  registerProcessor: (name: string, ctor: unknown) => void;
  sampleRate: number;
};

interface Options {
  processorOptions: { sab?: SharedArrayBuffer; capacity: number };
}

/**
 * Đọc bộ đệm vòng và phát ra loa, nội suy tuyến tính từ tần số của nhân sang tần số của AudioContext.
 * Trình phát không tự điều chỉnh tốc độ: Worker chạy khung hình khi bộ đệm vơi, nên giả lập tự bám theo
 * đồng hồ âm thanh (audio-driven sync).
 */
class RingProcessor extends g.AudioWorkletProcessor {
  private ring: Ring;
  private frac = 0;
  private quanta = 0;
  private received = 0;
  private consumed = 0;
  private reportPort: MessagePort | null = null;
  private primed = false; // đã phát ra mẫu thật kể từ lần chạy gần nhất

  constructor(options: Options) {
    super();
    const { sab, capacity } = options.processorOptions;
    this.ring = new Ring(sab ?? new ArrayBuffer(ringByteLength(capacity)), capacity);
    this.port.onmessage = (e: MessageEvent) => {
      if (e.data?.type === 'attachPort') {
        // Chế độ không có SharedArrayBuffer: Worker gửi PCM qua cổng này.
        const p = e.data.port as MessagePort;
        this.reportPort = p;
        p.onmessage = (ev: MessageEvent) => this.onPortMessage(ev.data);
      }
    };
  }

  private onPortMessage(m: { type: string; pcm?: ArrayBuffer; frames?: number; rate?: number; value?: boolean }) {
    const c = this.ring.ctrl;
    if (m.type === 'pcm' && m.pcm && m.frames) {
      this.received += m.frames;
      this.ring.write(new Int16Array(m.pcm), m.frames);
    } else if (m.type === 'rate') {
      Atomics.store(c, C_RATE, Math.round(m.rate ?? 0));
    } else if (m.type === 'running') {
      Atomics.store(c, C_RUNNING, m.value ? 1 : 0);
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const out = outputs[0];
    const left = out[0];
    const right = out[1] ?? out[0];
    const n = left.length;
    const ring = this.ring;
    const c = ring.ctrl;
    const data = ring.data;
    const mask = ring.mask;

    const srcRate = Atomics.load(c, C_RATE) || g.sampleRate;
    const step = srcRate / g.sampleRate;
    const w = Atomics.load(c, C_WRITE);
    let r = Atomics.load(c, C_READ);
    let frac = this.frac;
    let starved = false;
    const running = Atomics.load(c, C_RUNNING) === 1;
    if (!running) this.primed = false;

    for (let i = 0; i < n; i++) {
      if (((w - r) | 0) < 2) {
        left[i] = 0;
        right[i] = 0;
        starved = true;
        continue;
      }
      const i0 = (r & mask) * 2;
      const i1 = ((r + 1) & mask) * 2;
      this.primed = true;
      left[i] = (data[i0] + (data[i1] - data[i0]) * frac) / 32768;
      right[i] = (data[i0 + 1] + (data[i1 + 1] - data[i0 + 1]) * frac) / 32768;
      frac += step;
      while (frac >= 1 && ((w - r) | 0) > 0) {
        frac -= 1;
        r = (r + 1) | 0;
        this.consumed++;
      }
    }
    this.frac = frac;
    Atomics.store(c, C_READ, r);
    // Chỉ tính là vỡ tiếng khi đã phát được tiếng rồi mới hết dữ liệu (không tính lúc khởi động).
    if (starved && running && this.primed) Atomics.add(c, C_UNDERRUN, 1);

    if (this.reportPort && ++this.quanta % 4 === 0) {
      this.reportPort.postMessage({
        type: 'report',
        fill: ring.fill(),
        received: this.received,
        consumed: this.consumed,
        underruns: Atomics.load(c, C_UNDERRUN),
      });
    }
    return true;
  }
}

g.registerProcessor('ring-processor', RingProcessor);
