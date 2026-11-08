export type SortKey = 'recent' | 'name' | 'size';

/** Cài đặt giao diện, lưu trong IndexedDB (khoá 'ui.settings'). */
export interface UiSettings {
  sound: boolean;
  volume: number; // 0..100
  hidePad: boolean;
  vibrate: boolean;
  /** Giữ nút: chạm một lần để giữ, chạm lần nữa để nhả. */
  sticky: boolean;
  /** Hiện FPS và thông số âm thanh trên màn chơi. */
  showStats: boolean;
  sort: SortKey;
}
