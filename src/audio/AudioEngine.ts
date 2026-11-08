import workletUrl from './worklet/ring-processor.ts?worker&url';
import { ringByteLength } from './RingBuffer';
import type { AudioAttach } from './types';

/** Phía luồng chính: giữ AudioContext + AudioWorklet. (AudioContext không tạo được trong Worker.) */
export class AudioEngine {
  private constructor(
    private readonly ctx: AudioContext,
    private readonly gain: GainNode,
    readonly attach: AudioAttach,
  ) {}

  /** Phải gọi trong một thao tác của người dùng (bấm/chạm) để trình duyệt cho phép phát tiếng. */
  static async create(capacityFrames = 16384): Promise<AudioEngine> {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    await ctx.audioWorklet.addModule(workletUrl);

    const useSab = typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated;
    const buffer = useSab ? new SharedArrayBuffer(ringByteLength(capacityFrames)) : undefined;
    const node = new AudioWorkletNode(ctx, 'ring-processor', {
      numberOfInputs: 0,
      numberOfOutputs: 1,
      outputChannelCount: [2],
      processorOptions: { sab: buffer, capacity: capacityFrames },
    });

    let attach: AudioAttach;
    if (buffer) {
      attach = { transport: 'sab', buffer, capacityFrames };
    } else {
      const ch = new MessageChannel();
      node.port.postMessage({ type: 'attachPort', port: ch.port2 }, [ch.port2]);
      attach = { transport: 'port', port: ch.port1, capacityFrames };
    }

    const gain = ctx.createGain();
    node.connect(gain).connect(ctx.destination);
    await ctx.resume().catch(() => {});
    return new AudioEngine(ctx, gain, attach);
  }

  get state(): AudioContextState {
    return this.ctx.state;
  }

  async resume(): Promise<void> {
    if (this.ctx.state !== 'running') await this.ctx.resume().catch(() => {});
  }

  setVolume(v: number): void {
    this.gain.gain.value = Math.min(1, Math.max(0, v));
  }

  close(): void {
    void this.ctx.close();
  }
}
