import { RETRO_JOYPAD, type JoypadId } from '../systems/libretro';
import type { PadMap } from './mappings';

const STICK_THRESHOLD = 0.5;

function connectedPads(): Gamepad[] {
  const list = navigator.getGamepads?.() ?? [];
  return Array.from(list).filter((p): p is Gamepad => !!p && p.connected);
}

/** Gamepad API: đọc theo nhịp (poll), tự nhận khi cắm/rút. Chỉ tính người chơi 1 (gộp mọi tay cầm). */
export class GamepadInput {
  private prev = new Set<string>();
  private newPress: number | null = null;

  constructor(
    private map: PadMap,
    private readonly onDevices?: (names: string[]) => void,
  ) {}

  setMap(map: PadMap): void {
    this.map = map;
  }

  names(): string[] {
    return connectedPads().map((p) => p.id);
  }

  attach(): void {
    window.addEventListener('gamepadconnected', this.notify);
    window.addEventListener('gamepaddisconnected', this.notify);
    this.notify();
  }

  detach(): void {
    window.removeEventListener('gamepadconnected', this.notify);
    window.removeEventListener('gamepaddisconnected', this.notify);
  }

  private notify = (): void => {
    this.onDevices?.(this.names());
  };

  /** Trả về bitmask các nút đang nhấn trên mọi tay cầm đang cắm. */
  poll(): number {
    const pads = connectedPads();
    const cur = new Set<string>();
    let mask = 0;
    for (const pad of pads) {
      pad.buttons.forEach((b, i) => {
        if (b.pressed) cur.add(`${pad.index}:${i}`);
      });
      for (const [button, indices] of Object.entries(this.map) as [JoypadId, number[]][]) {
        if (indices.some((i) => pad.buttons[i]?.pressed)) mask |= 1 << RETRO_JOYPAD[button];
      }
      // Cần gạt trái = D-pad
      const x = pad.axes[0] ?? 0;
      const y = pad.axes[1] ?? 0;
      if (x < -STICK_THRESHOLD) mask |= 1 << RETRO_JOYPAD.LEFT;
      if (x > STICK_THRESHOLD) mask |= 1 << RETRO_JOYPAD.RIGHT;
      if (y < -STICK_THRESHOLD) mask |= 1 << RETRO_JOYPAD.UP;
      if (y > STICK_THRESHOLD) mask |= 1 << RETRO_JOYPAD.DOWN;
    }
    for (const key of cur) {
      if (!this.prev.has(key)) {
        this.newPress = Number(key.split(':')[1]);
        break;
      }
    }
    this.prev = cur;
    return mask;
  }

  /** Nút vừa mới được bấm kể từ lần gọi trước (dùng khi gán phím). */
  takePress(): number | null {
    const p = this.newPress;
    this.newPress = null;
    return p;
  }
}
