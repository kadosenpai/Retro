/** Phần của AudioSink mà bộ định nhịp cần dùng. */
export interface AudioPacing {
  fillFrames(): number;
  consumedFrames(): number;
  targetFrames(): number;
}

/**
 * Bộ định nhịp khung hình.
 * - Có âm thanh đang phát: chạy khung khi bộ đệm âm thanh vơi dưới mức mục tiêu, nên tốc độ giả lập
 *   bám theo đồng hồ âm thanh (hình và tiếng không bao giờ lệch dần).
 * - Không có âm thanh, hoặc âm thanh đứng (AudioContext bị treo): dùng đồng hồ hệ thống.
 */
export class FrameScheduler {
  private running = false;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private nextTime = 0;
  private frameMs: number;
  private lastConsumed = -1;
  private lastMove = 0;
  private wasAudio = false;

  constructor(
    private readonly step: () => void,
    private readonly present: () => void,
    fps: number,
    private readonly getAudio?: () => AudioPacing | null,
  ) {
    this.frameMs = 1000 / fps;
  }

  setFps(fps: number): void {
    this.frameMs = 1000 / fps;
  }

  get isRunning(): boolean {
    return this.running;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.nextTime = performance.now();
    this.lastConsumed = -1;
    this.lastMove = performance.now();
    this.wasAudio = false;
    this.tick();
  }

  stop(): void {
    this.running = false;
    if (this.timer !== undefined) clearTimeout(this.timer);
    this.timer = undefined;
  }

  /** Âm thanh có đang được tiêu thụ không (tránh đứng hình nếu AudioContext bị treo). */
  private audioMoving(a: AudioPacing, now: number): boolean {
    const c = a.consumedFrames();
    if (c !== this.lastConsumed) {
      this.lastConsumed = c;
      this.lastMove = now;
    }
    return now - this.lastMove < 300;
  }

  private tick = (): void => {
    if (!this.running) return;
    const now = performance.now();
    const audio = this.getAudio?.() ?? null;
    let ran = 0;

    if (audio && this.audioMoving(audio, now)) {
      this.wasAudio = true;
      const target = audio.targetFrames();
      while (audio.fillFrames() < target && ran < 6) {
        this.step();
        ran++;
      }
      if (ran > 0) this.present();
      this.timer = setTimeout(this.tick, 3);
      return;
    }

    if (this.wasAudio) {
      this.wasAudio = false;
      this.nextTime = now; // vừa chuyển về đồng hồ hệ thống
    }
    while (now >= this.nextTime && ran < 4) {
      this.step();
      this.nextTime += this.frameMs;
      ran++;
    }
    // Bị trễ quá nhiều thì bỏ qua phần trễ thay vì chạy dồn.
    if (performance.now() - this.nextTime > 100) this.nextTime = performance.now();
    if (ran > 0) this.present();
    const wait = Math.max(0, this.nextTime - performance.now());
    this.timer = setTimeout(this.tick, wait);
  };
}
