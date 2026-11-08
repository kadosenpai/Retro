/**
 * Nơi đặt nhân giả lập (mgba_libretro.js + .wasm), thử lần lượt từ trên xuống.
 * - cores/mgba/ (theo BASE_URL): thư mục public của dự án (dùng khi triển khai thật, hoặc chạy máy cá nhân).
 * - jsDelivr: lấy trực tiếp từ kho GitHub (công khai) — dùng khi dự án trên StackBlitz bị giới hạn 1MB.
 *   Cấu trúc trong kho: cores/mgba/mgba_libretro.js và mgba_libretro.wasm
 *   Nên thay `main` bằng mã commit (vd. @a1b2c3d) để tránh bị cache bản cũ.
 */
export const CORE_SOURCES: string[] = [
  `${import.meta.env.BASE_URL}cores/mgba/`,
  'https://cdn.jsdelivr.net/gh/kadosenpai/retro-web@main/cores/mgba/',
];

/** Chọn nguồn đầu tiên thật sự có file JS của nhân (không phải trang HTML dự phòng của Vite). */
export async function resolveCoreUrl(file = 'mgba_libretro.js'): Promise<string> {
  for (const base of CORE_SOURCES) {
    try {
      const res = await fetch(base + file, { method: 'HEAD' });
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && !type.includes('text/html')) return base + file;
    } catch {
      /* thử nguồn tiếp theo */
    }
  }
  return CORE_SOURCES[0] + file;
}
