import { C_RATE, C_READ, C_RUNNING, C_UNDERRUN, Ring } from '../../audio/RingBuffer';

/** Phía Worker: nơi ghi PCM và cho biết bộ đệm đầy đến đâu (để định nhịp giả lập). */
export interface AudioSink {
  write(pcm: Int16Array, frames: number): void;
  setSourceRate(rate: number): void;
  setRunning(running: boolean): void;
  fillFrames(): number;
  consumedFrames(): number;
  targetFrames(): number;
  underruns(): number;
}

/** Độ trễ âm thanh mục tiêu: càng thấp càng nhạy, nhưng dễ vỡ tiếng khi máy yếu. */
export const TARGET_AUDIO_MS = 70;

export class SabSink implements AudioSink {
  private ring: Ring;
  private rate = 65536;

  constructor(buffer: SharedArrayBuffer, private readonly capacityFrames: number) {
    this.ring = new Ring(buffer, capacityFrames);
  }
  write(pcm: Int16Array, frames: number): void {
    this.ring.write(pcm, frames);
  }
  setSourceRate(rate: number): void {
    this.rate = rate;
    Atomics.store(this.ring.ctrl, C_RATE, Math.round(rate));
  }
  setRunning(running: boolean): void {
    Atomics.store(this.ring.ctrl, C_RUNNING, running ? 1 : 0);
  }
  fillFrames(): number {
    return this.ring.fill();
  }
  consumedFrames(): number {
    return Atomics.load(this.ring.ctrl, C_READ);
  }
  targetFrames(): number {
    // Chạy nhanh thì tốc độ nguồn tăng: giới hạn để mục tiêu không vượt quá nửa sức chứa bộ đệm.
    return Math.min(Math.round((this.rate * TARGET_AUDIO_MS) / 1000), this.capacityFrames >> 1);
  }
  underruns(): number {
    return Atomics.load(this.ring.ctrl, C_UNDERRUN);
  }
}

/** Dự phòng khi không có SharedArrayBuffer: gửi PCM qua MessagePort, ước lượng mức đầy từ báo cáo của Worklet. */
export class PortSink implements AudioSink {
  private rate = 65536;
  private running = false;
  private written = 0;
  private rep = { fill: 0, received: 0, consumed: 0, underruns: 0, at: performance.now() };

  constructor(
    private readonly port: MessagePort,
    private readonly capacityFrames: number,
  ) {
    port.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m?.type === 'report') {
        this.rep = {
          fill: m.fill,
          received: m.received,
          consumed: m.consumed,
          underruns: m.underruns,
          at: performance.now(),
        };
      }
    };
  }
  write(pcm: Int16Array, frames: number): void {
    // Worklet không theo kịp (vd. AudioContext bị treo): bỏ bớt thay vì để hàng đợi phình mãi.
    if (this.written - this.rep.received > this.capacityFrames) return;
    const copy = pcm.slice(0, frames * 2);
    this.written += frames;
    this.port.postMessage({ type: 'pcm', pcm: copy.buffer, frames }, [copy.buffer]);
  }
  setSourceRate(rate: number): void {
    this.rate = rate;
    this.port.postMessage({ type: 'rate', rate });
  }
  setRunning(running: boolean): void {
    this.running = running;
    this.port.postMessage({ type: 'running', value: running });
  }
  fillFrames(): number {
    const r = this.rep;
    const inFlight = Math.max(0, this.written - r.received);
    const elapsed = Math.min(performance.now() - r.at, 50); // báo cáo đến đều, tránh ước lượng trôi
    const drained = this.running ? (elapsed * this.rate) / 1000 : 0;
    return Math.max(0, r.fill + inFlight - drained);
  }
  consumedFrames(): number {
    return this.rep.consumed;
  }
  targetFrames(): number {
    // Chạy nhanh thì tốc độ nguồn tăng: giới hạn để mục tiêu không vượt quá nửa sức chứa bộ đệm.
    return Math.min(Math.round((this.rate * TARGET_AUDIO_MS) / 1000), this.capacityFrames >> 1);
  }
  underruns(): number {
    return this.rep.underruns;
  }
}
