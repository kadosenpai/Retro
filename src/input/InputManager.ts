import type { JoypadId } from '../systems/libretro';
import type { SystemProfile } from '../systems/types';
import { deleteSetting, getSetting, setSetting } from '../storage/SettingsStore';
import { GamepadInput } from './GamepadInput';
import { KeyboardInput } from './KeyboardInput';
import {
  assignKey,
  assignPad,
  clearMappings,
  defaultMappings,
  loadMappings,
  mappingsSettingKey,
  sanitizeMappings,
  saveMappings,
  type Mappings,
} from './mappings';

export type Captured = { kind: 'key'; code: string } | { kind: 'pad'; index: number };

/** Gộp bàn phím + tay cầm + cảm ứng thành một bitmask nút duy nhất rồi gửi cho giả lập khi có thay đổi. */
export class InputManager {
  mappings: Mappings;
  private readonly keyboard: KeyboardInput;
  private readonly gamepad: GamepadInput;
  private touchMask = 0;
  private padMask = 0;
  private lastSent = 0;
  private raf = 0;
  private capturing = false;
  private finishCapture: ((c: Captured | null) => void) | null = null;

  constructor(
    private readonly system: SystemProfile,
    private readonly send: (mask: number) => void,
    onDevices?: (names: string[]) => void,
  ) {
    this.mappings = loadMappings(system);
    this.keyboard = new KeyboardInput(this.mappings.keyboard, () => this.emit());
    this.gamepad = new GamepadInput(this.mappings.gamepad, onDevices);
  }

  start(): void {
    this.keyboard.attach();
    this.gamepad.attach();
    const loop = () => {
      this.padMask = this.gamepad.poll();
      if (this.capturing) {
        const p = this.gamepad.takePress();
        if (p !== null) this.finishCapture?.({ kind: 'pad', index: p });
      }
      this.emit();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop(): void {
    cancelAnimationFrame(this.raf);
    this.keyboard.detach();
    this.gamepad.detach();
    this.touchMask = 0;
    this.padMask = 0;
    this.emit();
  }

  /** Nối với TouchOverlay: truyền hàm này làm onMask. */
  setTouchMask = (mask: number): void => {
    this.touchMask = mask;
    this.emit();
  };

  private emit(): void {
    const m = this.capturing ? 0 : (this.keyboard.mask | this.padMask | this.touchMask) >>> 0;
    if (m !== this.lastSent) {
      this.lastSent = m;
      this.send(m);
    }
  }

  /** Chờ người dùng nhấn một phím hoặc một nút tay cầm (Esc hoặc hết 10 giây thì huỷ). */
  capture(timeoutMs = 10000): Promise<Captured | null> {
    this.finishCapture?.(null);
    return new Promise((resolve) => {
      const onKey = (ev: KeyboardEvent) => {
        ev.preventDefault();
        ev.stopImmediatePropagation();
        done(ev.code === 'Escape' ? null : { kind: 'key', code: ev.code });
      };
      const timer = setTimeout(() => done(null), timeoutMs);
      const done = (c: Captured | null) => {
        if (!this.capturing) return;
        this.capturing = false;
        this.finishCapture = null;
        window.removeEventListener('keydown', onKey, true);
        clearTimeout(timer);
        resolve(c);
        this.emit();
      };
      this.capturing = true;
      this.finishCapture = done;
      this.gamepad.takePress();
      window.addEventListener('keydown', onKey, true);
      this.emit();
    });
  }

  private applyMappings(m: Mappings): void {
    this.mappings = m;
    this.keyboard.setMap(m.keyboard);
    this.gamepad.setMap(m.gamepad);
  }

  private persist(): void {
    saveMappings(this.system, this.mappings); // bản đệm đọc nhanh
    setSetting(mappingsSettingKey(this.system), this.mappings).catch(() => {});
  }

  /**
   * Đọc bảng phím từ IndexedDB (nguồn chính). Nếu IndexedDB chưa có mà localStorage đã có
   * tuỳ chỉnh từ trước thì chuyển sang IndexedDB. Trả về bảng đang dùng.
   */
  async hydrate(): Promise<Mappings> {
    try {
      const stored = await getSetting<unknown>(mappingsSettingKey(this.system));
      if (stored) {
        this.applyMappings(sanitizeMappings(this.system, stored));
        saveMappings(this.system, this.mappings);
      } else if (
        JSON.stringify(this.mappings) !== JSON.stringify(defaultMappings(this.system))
      ) {
        await setSetting(mappingsSettingKey(this.system), this.mappings);
      }
    } catch {
      /* IndexedDB không dùng được: giữ bản localStorage */
    }
    return this.mappings;
  }

  assign(button: JoypadId, captured: Captured): void {
    this.applyMappings(
      captured.kind === 'key'
        ? assignKey(this.mappings, button, captured.code)
        : assignPad(this.mappings, button, captured.index),
    );
    this.persist();
  }

  resetMappings(): void {
    this.applyMappings(defaultMappings(this.system));
    clearMappings(this.system);
    deleteSetting(mappingsSettingKey(this.system)).catch(() => {});
  }
}
