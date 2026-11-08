import { toMask, type JoypadId } from '../systems/libretro';
import type { TouchControl } from '../systems/types';

export interface TouchLayouts {
  portrait: TouchControl[];
  landscape: TouchControl[];
}

/** Tuỳ chỉnh của người dùng cho một điều khiển: tâm (% vùng overlay) và hệ số kích thước. */
export interface LayoutOverride {
  cx: number;
  cy: number;
  scale: number;
}
export type LayoutOverrides = Record<string, LayoutOverride>;

export interface TouchEditor {
  /** Gọi khi người dùng thả tay sau khi kéo một điều khiển. */
  onChange(id: string, ov: LayoutOverride): void;
  /** Gọi khi chọn một điều khiển (hoặc null khi bỏ chọn). */
  onSelect(id: string | null): void;
}

export interface TouchOptions {
  /** Bố cục dùng: 'portrait' | 'landscape'. 'auto' = theo hướng cửa sổ. */
  orientation?: 'auto' | 'portrait' | 'landscape';
  /** Rung khi nhấn nút (chỉ Android). Mặc định: bật. */
  vibrate?: boolean;
  /** Giữ nút: chạm một lần để giữ nút xuống, chạm lần nữa để nhả. */
  sticky?: boolean;
  /** Vị trí/kích thước người dùng đã chỉnh, theo id điều khiển (của bố cục đang dùng). */
  overrides?: LayoutOverrides;
  /** Người dùng bấm nút ▲ (menu). */
  onMenu?: () => void;
  /** Có giá trị = chế độ chỉnh sửa: kéo để di chuyển, không gửi phím nào cho game. */
  editor?: TouchEditor;
  /** Điều khiển đang được chọn ở chế độ chỉnh sửa. */
  selected?: string | null;
}

interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Item {
  ctrl: TouchControl;
  el: HTMLElement;
  hit: Rect;
  thumb?: HTMLElement; // dpad: núm trượt
  cx: number; // % hiện tại (đã áp tuỳ chỉnh)
  cy: number;
  scale: number;
}

const STYLE_ID = 'tv-touch-style-v2';
const CSS = `
.tv-root{position:absolute;inset:0;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent;overflow:hidden}
.tv-ctrl{position:absolute;box-sizing:border-box;display:flex;align-items:center;justify-content:center;color:#f2f2f2;font:800 22px Inter,system-ui,sans-serif;background:rgba(22,22,27,.9);border:2px solid rgba(255,255,255,.28);pointer-events:none;transition:background .05s}
.tv-root.land .tv-ctrl{background:rgba(22,22,27,.6)}
.tv-btn,.tv-menu{border-radius:50%}
.tv-menu{font-size:16px}
.tv-pill{border-radius:999px;font-size:13px;letter-spacing:.12em;text-transform:uppercase}
.tv-dpad{border-radius:50%}
.tv-thumb{position:absolute;left:31%;top:31%;width:38%;height:38%;border-radius:50%;background:rgba(255,255,255,.2);border:2px solid rgba(255,255,255,.38);transition:transform .04s}
.tv-ctrl.on{background:rgba(74,74,84,.95)}
.tv-dpad.on .tv-thumb{background:rgba(255,255,255,.34)}
.tv-ctrl.sel{outline:3px solid #fff;outline-offset:3px}
.tv-root.edit .tv-ctrl{border-style:dashed}
`;

const DPAD_DEADZONE = 0.3;
const THUMB_TRAVEL = 0.3; // núm lệch tối đa, theo tỉ lệ bán kính

/**
 * Bàn phím ảo đa điểm bằng Pointer Events. Bố cục lấy từ hồ sơ hệ máy, chồng thêm tuỳ chỉnh của người dùng.
 * Mỗi ngón tay được theo dõi riêng, có thể trượt từ nút này sang nút khác; D-pad nhận 8 hướng.
 */
export class TouchOverlay {
  private root = document.createElement('div');
  private items: Item[] = [];
  private pointers = new Map<number, { x: number; y: number }>();
  private pressed = new Set<JoypadId>();
  private touched = new Set<JoypadId>(); // nút đang bị ngón tay chạm (không tính nút giữ)
  private latched = new Set<JoypadId>(); // nút đang được giữ (chế độ giữ nút)
  private mask = 0;
  private layoutKey = '';
  private ro: ResizeObserver;
  private overrides: LayoutOverrides;
  private selected: string | null;
  private menuPtr = -1;
  private drag: { id: string; pointerId: number; dx: number; dy: number } | null = null;

  constructor(
    container: HTMLElement,
    private readonly layouts: TouchLayouts,
    private readonly onMask: (mask: number) => void,
    private readonly opts: TouchOptions = {},
  ) {
    if (!document.getElementById(STYLE_ID)) {
      const style = document.createElement('style');
      style.id = STYLE_ID;
      style.textContent = CSS;
      document.head.appendChild(style);
    }
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';

    this.overrides = { ...(opts.overrides ?? {}) };
    this.selected = opts.selected ?? null;

    this.root.className = 'tv-root';
    this.root.addEventListener('pointerdown', this.onDown);
    this.root.addEventListener('pointermove', this.onMove);
    this.root.addEventListener('pointerup', this.onUp);
    this.root.addEventListener('pointercancel', this.onUp);
    this.root.addEventListener('lostpointercapture', this.onUp);
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    container.appendChild(this.root);

    this.ro = new ResizeObserver(() => this.layout());
    this.ro.observe(container);
    this.layout();
  }

  destroy(): void {
    this.ro.disconnect();
    this.pointers.clear();
    this.latched.clear();
    this.update();
    this.root.remove();
  }

  /** Chỉnh sửa: đổi hệ số kích thước của điều khiển (áp ngay, không cần tạo lại). */
  setScale(id: string, scale: number): void {
    const it = this.items.find((i) => i.ctrl.id === id);
    if (!it) return;
    it.scale = scale;
    this.overrides[id] = { cx: it.cx, cy: it.cy, scale };
    this.place(it);
  }

  /** Chỉnh sửa: thay toàn bộ tuỳ chỉnh (vd. {} để khôi phục mặc định). */
  setOverrides(o: LayoutOverrides): void {
    this.overrides = { ...o };
    this.layoutKey = '';
    this.layout();
  }

  /** Vị trí/kích thước hiện tại của một điều khiển (để lưu). */
  getOverride(id: string): LayoutOverride | null {
    const it = this.items.find((i) => i.ctrl.id === id);
    return it ? { cx: it.cx, cy: it.cy, scale: it.scale } : null;
  }

  setSelected(id: string | null): void {
    this.selected = id;
    for (const it of this.items) it.el.classList.toggle('sel', it.ctrl.id === id);
  }

  private orientation(): 'portrait' | 'landscape' {
    const forced = this.opts.orientation ?? 'auto';
    if (forced !== 'auto') return forced;
    return window.matchMedia('(orientation: portrait)').matches ? 'portrait' : 'landscape';
  }

  private dims(): { w: number; h: number; short: number } {
    const rect = this.root.getBoundingClientRect();
    return { w: rect.width, h: rect.height, short: Math.min(rect.width, rect.height) };
  }

  /** Đặt vị trí/kích thước phần tử và vùng bắt của một điều khiển. */
  private place(it: Item): void {
    const { w, h, short } = this.dims();
    const cw = ((it.ctrl.w * it.scale) / 100) * short;
    const ch = ((it.ctrl.h * it.scale) / 100) * short;
    const cx = (it.cx / 100) * w;
    const cy = (it.cy / 100) * h;
    Object.assign(it.el.style, {
      left: `${cx - cw / 2}px`,
      top: `${cy - ch / 2}px`,
      width: `${cw}px`,
      height: `${ch}px`,
    });
    const m = it.ctrl.kind === 'dpad' ? cw * 0.15 : 10; // vùng bắt rộng hơn hình vẽ
    it.hit = { x0: cx - cw / 2 - m, y0: cy - ch / 2 - m, x1: cx + cw / 2 + m, y1: cy + ch / 2 + m };
  }

  private layout(): void {
    const { w, h } = this.dims();
    if (w <= 0 || h <= 0) return;
    const orientation = this.orientation();
    const key = `${orientation}:${Math.round(w)}x${Math.round(h)}`;
    if (key === this.layoutKey) return;
    this.layoutKey = key;

    this.pointers.clear();
    this.latched.clear();
    this.root.replaceChildren();
    this.root.classList.toggle('land', orientation === 'landscape');
    this.root.classList.toggle('edit', !!this.opts.editor);
    this.items = [];

    for (const ctrl of this.layouts[orientation]) {
      const ov = this.overrides[ctrl.id];
      const el = document.createElement('div');
      el.className = `tv-ctrl tv-${ctrl.kind === 'button' ? 'btn' : ctrl.kind}`;
      const item: Item = {
        ctrl,
        el,
        hit: { x0: 0, y0: 0, x1: 0, y1: 0 },
        cx: ov?.cx ?? ctrl.cx,
        cy: ov?.cy ?? ctrl.cy,
        scale: ov?.scale ?? 1,
      };
      if (ctrl.kind === 'dpad') {
        item.thumb = document.createElement('div');
        item.thumb.className = 'tv-thumb';
        el.appendChild(item.thumb);
      } else {
        el.textContent = ctrl.label ?? '';
      }
      el.classList.toggle('sel', ctrl.id === this.selected);
      this.place(item);
      this.root.appendChild(el);
      this.items.push(item);
    }
    this.update();
  }

  private local(e: PointerEvent): { x: number; y: number } {
    const r = this.root.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private itemAt(p: { x: number; y: number }): Item | undefined {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const { x0, y0, x1, y1 } = this.items[i].hit;
      if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) return this.items[i];
    }
    return undefined;
  }

  private onDown = (e: PointerEvent): void => {
    e.preventDefault();
    try {
      this.root.setPointerCapture(e.pointerId);
    } catch {
      /* bỏ qua */
    }
    const p = this.local(e);

    if (this.opts.editor) {
      const it = this.itemAt(p);
      this.selected = it?.ctrl.id ?? null;
      this.setSelected(this.selected);
      this.opts.editor.onSelect(this.selected);
      if (it) {
        const { w, h } = this.dims();
        this.drag = {
          id: it.ctrl.id,
          pointerId: e.pointerId,
          dx: p.x - (it.cx / 100) * w,
          dy: p.y - (it.cy / 100) * h,
        };
      }
      return;
    }

    if (this.itemAt(p)?.ctrl.kind === 'menu') {
      this.menuPtr = e.pointerId;
      this.itemAt(p)!.el.classList.add('on');
      return; // nút menu không gửi phím nào
    }
    this.pointers.set(e.pointerId, p);
    this.update();
  };

  private onMove = (e: PointerEvent): void => {
    if (this.drag && this.drag.pointerId === e.pointerId) {
      e.preventDefault();
      const it = this.items.find((i) => i.ctrl.id === this.drag!.id);
      if (!it) return;
      const p = this.local(e);
      const { w, h } = this.dims();
      it.cx = Math.min(100, Math.max(0, ((p.x - this.drag.dx) / w) * 100));
      it.cy = Math.min(100, Math.max(0, ((p.y - this.drag.dy) / h) * 100));
      this.place(it);
      return;
    }
    if (!this.pointers.has(e.pointerId)) return;
    e.preventDefault();
    this.pointers.set(e.pointerId, this.local(e));
    this.update();
  };

  private onUp = (e: PointerEvent): void => {
    if (this.drag && this.drag.pointerId === e.pointerId) {
      const it = this.items.find((i) => i.ctrl.id === this.drag!.id);
      this.drag = null;
      if (it) {
        this.overrides[it.ctrl.id] = { cx: it.cx, cy: it.cy, scale: it.scale };
        this.opts.editor?.onChange(it.ctrl.id, { cx: it.cx, cy: it.cy, scale: it.scale });
      }
      return;
    }
    if (this.menuPtr === e.pointerId) {
      this.menuPtr = -1;
      const menu = this.items.find((i) => i.ctrl.kind === 'menu');
      menu?.el.classList.remove('on');
      if (e.type === 'pointerup' && menu) {
        const p = this.local(e);
        const { x0, y0, x1, y1 } = menu.hit;
        if (p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1) {
          // Chặn "click ma" do trình duyệt sinh ra sau thao tác chạm: nếu không, nó rơi vào
          // nút nằm đúng vị trí ngón tay trong menu vừa mở (vd. "Reset game").
          const swallow = (ev: Event) => {
            ev.stopPropagation();
            ev.preventDefault();
          };
          window.addEventListener('click', swallow, true);
          setTimeout(() => window.removeEventListener('click', swallow, true), 500);
          this.opts.onMenu?.();
        }
      }
      return;
    }
    if (this.pointers.delete(e.pointerId)) this.update();
  };

  /** Tính lại tập nút đang nhấn từ vị trí mọi ngón tay. */
  private update(): void {
    const touch = new Set<JoypadId>();
    const thumbs = new Map<Item, { x: number; y: number }>();
    for (const p of this.pointers.values()) {
      for (const it of this.items) {
        const { x0, y0, x1, y1 } = it.hit;
        if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
        if (it.ctrl.kind === 'dpad') {
          const [up, down, left, right] = it.ctrl.buttons;
          const nx = (p.x - (x0 + x1) / 2) / ((x1 - x0) / 2);
          const ny = (p.y - (y0 + y1) / 2) / ((y1 - y0) / 2);
          if (ny < -DPAD_DEADZONE) touch.add(up);
          if (ny > DPAD_DEADZONE) touch.add(down);
          if (nx < -DPAD_DEADZONE) touch.add(left);
          if (nx > DPAD_DEADZONE) touch.add(right);
          const len = Math.hypot(nx, ny) || 1;
          const k = Math.min(1, len) / len;
          thumbs.set(it, { x: nx * k, y: ny * k });
        } else if (it.ctrl.kind !== 'menu') {
          for (const b of it.ctrl.buttons) touch.add(b);
        }
      }
    }

    // Giữ nút: mỗi lần mới chạm vào một nút (không phải D-pad) thì đảo trạng thái giữ.
    if (this.opts.sticky) {
      const dpadButtons = new Set<JoypadId>();
      for (const it of this.items) if (it.ctrl.kind === 'dpad') it.ctrl.buttons.forEach((b) => dpadButtons.add(b));
      for (const b of touch) {
        if (this.touched.has(b) || dpadButtons.has(b)) continue;
        if (this.latched.has(b)) this.latched.delete(b);
        else this.latched.add(b);
      }
    } else if (this.latched.size) {
      this.latched.clear();
    }
    this.touched = touch;

    const next = new Set<JoypadId>(touch);
    for (const b of this.latched) next.add(b);

    let newlyDown = false;
    for (const b of next) if (!this.pressed.has(b)) newlyDown = true;
    this.pressed = next;

    for (const it of this.items) {
      if (it.ctrl.kind === 'menu') continue;
      it.el.classList.toggle('on', it.ctrl.buttons.some((b) => next.has(b)));
      if (it.thumb) {
        const t = thumbs.get(it);
        const r = (it.hit.x1 - it.hit.x0) / 2;
        it.thumb.style.transform = t
          ? `translate(${t.x * THUMB_TRAVEL * r}px, ${t.y * THUMB_TRAVEL * r}px)`
          : '';
      }
    }
    if (newlyDown && this.opts.vibrate !== false) navigator.vibrate?.(8);

    const mask = toMask(next);
    if (mask !== this.mask) {
      this.mask = mask;
      this.onMask(mask);
    }
  }
}
