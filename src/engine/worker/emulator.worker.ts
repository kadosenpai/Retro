import type { HostToWorker, WorkerToHost } from '../protocol';
import { CoreBridge } from './CoreBridge';
import { PortSink, SabSink, type AudioSink } from './AudioSink';
import { FrameScheduler } from './FrameScheduler';
import { createRenderer } from '../../render/createRenderer';
import { DEFAULT_RENDER_OPTIONS, type RenderOptions, type Renderer } from '../../render/types';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let bridge: CoreBridge | null = null;
let loaded = false;
let framesThisSecond = 0;
let lastStats = performance.now();
let hasNewFrame = false;
let renderer: Renderer | null = null;
let renderOptions: RenderOptions = { ...DEFAULT_RENDER_OPTIONS };
let sink: AudioSink | null = null;
let sourceRate = 0;
let baseFps = 60;
let speed = 1;

/** Áp tốc độ: đồng hồ hệ thống nhanh lên, và âm thanh bị tiêu thụ nhanh hơn (bộ định nhịp bám theo). */
function applySpeed(): void {
  scheduler.setFps(baseFps * speed);
  if (sourceRate) sink?.setSourceRate(sourceRate * speed);
}
let currentKey: string | null = null;
let lastSram: Uint8Array | null = null;

function applyCheats(list: { code: string; enabled: boolean }[]): void {
  if (!bridge) return;
  if (!bridge.setCheats(list) && list.some((c) => c.enabled)) {
    send({ type: 'notice', message: 'Nhân hiện tại chưa hỗ trợ cheat (cần build lại Wasm).' });
  }
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Gửi SRAM về luồng chính nếu nó đã thay đổi so với lần trước. */
function flushSram(): void {
  if (!bridge || !loaded || currentKey === null) return;
  const cur = bridge.readSram();
  if (!cur || (lastSram && sameBytes(cur, lastSram))) return;
  lastSram = cur.slice();
  const buf = cur.buffer as ArrayBuffer;
  send({ type: 'sram', key: currentKey, data: buf }, [buf]);
}

function send(msg: WorkerToHost, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer);
}

function fail(e: unknown): void {
  send({ type: 'error', message: e instanceof Error ? e.message : String(e) });
}

const scheduler = new FrameScheduler(
  () => {
    if (!bridge) return;
    if (bridge.runFrame()) hasNewFrame = true;
    if (sink) {
      const a = bridge.audioView();
      if (a.frames > 0) sink.write(a.pcm, a.frames);
    }
    framesThisSecond++;
  },
  () => {
    if (bridge && hasNewFrame) {
      if (renderer) {
        const v = bridge.frameView();
        if (v) renderer.draw(v);
      } else {
        // Không có canvas trong Worker: gửi hình về luồng chính (phương án dự phòng).
        const f = bridge.readFrame();
        if (f) {
          const buf = f.pixels.buffer as ArrayBuffer; // slice() luôn tạo buffer riêng
          send({ type: 'frame', width: f.width, height: f.height, format: f.format, pixels: buf }, [buf]);
        }
      }
      hasNewFrame = false;
    }
    const now = performance.now();
    if (now - lastStats >= 1000) {
      send({
        type: 'stats',
        fps: (framesThisSecond * 1000) / (now - lastStats),
        underruns: sink?.underruns() ?? 0,
        audioFillMs: sink && sourceRate ? (sink.fillFrames() * 1000) / (sourceRate * speed) : null,
      });
      framesThisSecond = 0;
      lastStats = now;
    }
  },
  60,
  () => sink,
);

ctx.onmessage = async (ev: MessageEvent<HostToWorker>) => {
  const msg = ev.data;
  try {
    switch (msg.type) {
      case 'init':
        bridge = await CoreBridge.create(msg.coreJsUrl);
        send({ type: 'ready' });
        break;

      case 'attachCanvas':
        renderer = createRenderer(msg.canvas, renderOptions);
        send({ type: 'renderer', kind: renderer.kind });
        break;

      case 'renderOptions':
        renderOptions = msg.options;
        renderer?.setOptions(msg.options);
        break;

      case 'resize':
        renderer?.resize(msg.width, msg.height);
        break;

      case 'audioAttach':
        sink =
          msg.attach.transport === 'sab'
            ? new SabSink(msg.attach.buffer, msg.attach.capacityFrames)
            : new PortSink(msg.attach.port, msg.attach.capacityFrames);
        if (sourceRate) sink.setSourceRate(sourceRate * speed);
        sink.setRunning(scheduler.isRunning);
        break;

      case 'loadRom': {
        if (!bridge) throw new Error('Nhân chưa sẵn sàng');
        scheduler.stop();
        flushSram(); // lưu nốt game đang chơi (nếu có) trước khi thay
        if (loaded) bridge.unloadGame();
        loaded = false;
        const info = bridge.loadGame(
          new Uint8Array(msg.rom),
          msg.sram ? new Uint8Array(msg.sram) : undefined,
        );
        loaded = true;
        currentKey = msg.key ?? null;
        if (msg.cheats?.length) applyCheats(msg.cheats);
        lastSram = bridge.readSram(); // mốc so sánh: chỉ lưu khi có thay đổi thật
        baseFps = info.fps;
        sourceRate = info.sampleRate;
        applySpeed();
        if (renderer) {
          const v = bridge.frameView(); // hiện ngay khung đầu tiên
          if (v) renderer.draw(v);
        }
        send({ type: 'loaded', info });
        break;
      }

      case 'run':
        if (loaded) {
          framesThisSecond = 0;
          lastStats = performance.now();
          sink?.setRunning(true);
          scheduler.start();
        }
        break;

      case 'pause':
        scheduler.stop();
        sink?.setRunning(false);
        flushSram();
        break;

      case 'flushSram':
        flushSram();
        break;

      case 'cheats':
        if (loaded) applyCheats(msg.list);
        break;

      case 'speed':
        speed = Math.min(8, Math.max(0.25, msg.value));
        applySpeed();
        break;

      case 'snapshot': {
        const f = bridge && loaded ? bridge.readFrame() : null;
        const frame = f
          ? { width: f.width, height: f.height, format: f.format, pixels: f.pixels.buffer as ArrayBuffer }
          : null;
        send({ type: 'snapshot', key: msg.key, frame }, frame ? [frame.pixels] : []);
        break;
      }

      case 'saveState': {
        let st: Uint8Array | null = null;
        try {
          if (!bridge || !loaded) throw new Error('Chưa có game để lưu state');
          st = bridge.saveState();
        } catch (e) {
          send({ type: 'notice', message: e instanceof Error ? e.message : String(e) });
        }
        if (!st || !bridge) {
          if (!st) send({ type: 'notice', message: 'Nhân không lưu được state' });
          break;
        }
        const f = bridge.readFrame();
        const data = st.buffer as ArrayBuffer;
        const frame = f
          ? { width: f.width, height: f.height, format: f.format, pixels: f.pixels.buffer as ArrayBuffer }
          : null;
        send(
          { type: 'state', key: msg.key, slot: msg.slot, data, frame },
          frame ? [data, frame.pixels] : [data],
        );
        break;
      }

      case 'loadState': {
        let ok = false;
        try {
          if (!bridge || !loaded) throw new Error('Chưa có game để nạp state');
          ok = bridge.loadState(new Uint8Array(msg.data));
          if (ok) hasNewFrame = true;
        } catch (e) {
          send({ type: 'notice', message: e instanceof Error ? e.message : String(e) });
        }
        send({ type: 'stateLoaded', ok });
        break;
      }

      case 'reset':
        bridge?.reset();
        break;

      case 'input':
        bridge?.setInput(msg.mask);
        break;

      case 'unload':
        scheduler.stop();
        sink?.setRunning(false);
        flushSram();
        if (loaded) bridge?.unloadGame();
        loaded = false;
        currentKey = null;
        break;
    }
  } catch (e) {
    scheduler.stop();
    fail(e);
  }
};
