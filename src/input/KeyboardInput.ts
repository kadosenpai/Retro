import { RETRO_JOYPAD, type JoypadId } from '../systems/libretro';
import type { KeyMap } from './mappings';

const NON_TEXT_INPUTS = ['range', 'checkbox', 'radio', 'button', 'file', 'submit', 'reset'];

/** Đang gõ chữ vào ô nhập thì không chiếm phím. */
function isTextEntry(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  if (t.isContentEditable || t instanceof HTMLTextAreaElement) return true;
  return t instanceof HTMLInputElement && !NON_TEXT_INPUTS.includes(t.type);
}

export class KeyboardInput {
  private codeToButton = new Map<string, JoypadId>();
  private down = new Set<string>();

  constructor(
    map: KeyMap,
    private readonly onChange: () => void,
  ) {
    this.loadMap(map);
  }

  private loadMap(map: KeyMap): void {
    this.codeToButton.clear();
    for (const [button, codes] of Object.entries(map) as [JoypadId, string[] | undefined][]) {
      for (const code of codes ?? []) this.codeToButton.set(code, button);
    }
    this.down.clear();
  }

  setMap(map: KeyMap): void {
    this.loadMap(map);
    this.onChange();
  }

  get mask(): number {
    let m = 0;
    for (const code of this.down) {
      const b = this.codeToButton.get(code);
      if (b) m |= 1 << RETRO_JOYPAD[b];
    }
    return m;
  }

  attach(): void {
    window.addEventListener('keydown', this.onDown);
    window.addEventListener('keyup', this.onUp);
    window.addEventListener('blur', this.releaseAll);
    document.addEventListener('visibilitychange', this.releaseAll);
  }

  detach(): void {
    window.removeEventListener('keydown', this.onDown);
    window.removeEventListener('keyup', this.onUp);
    window.removeEventListener('blur', this.releaseAll);
    document.removeEventListener('visibilitychange', this.releaseAll);
    this.releaseAll();
  }

  private onDown = (ev: KeyboardEvent): void => {
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return; // để dành cho phím tắt của trình duyệt
    if (isTextEntry(ev.target)) return;
    if (!this.codeToButton.has(ev.code)) return;
    ev.preventDefault();
    if (!this.down.has(ev.code)) {
      this.down.add(ev.code);
      this.onChange();
    }
  };

  private onUp = (ev: KeyboardEvent): void => {
    if (this.down.delete(ev.code)) this.onChange();
  };

  private releaseAll = (): void => {
    if (this.down.size > 0) {
      this.down.clear();
      this.onChange();
    }
  };
}
