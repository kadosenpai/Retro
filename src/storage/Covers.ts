/**
 * Ảnh bìa game.
 * - fetchBoxArt: tải ảnh bìa gốc từ thư viện thumbnail của libretro theo tên file chuẩn (No-Intro).
 * - toCoverBlob: thu nhỏ một ảnh (do người dùng chọn) thành JPEG gọn để lưu.
 */

const SYSTEM_DIRS: Record<string, string> = {
  gba: 'Nintendo - Game Boy Advance',
};

/** libretro đổi các ký tự không hợp lệ trong tên file thành "_". */
function thumbName(name: string): string {
  return name.replace(/[&*/:`<>?\\|]/g, '_');
}

/**
 * Các nguồn ảnh, thử lần lượt. raw.githubusercontent.com cho phép CORS (thumbnails.libretro.com thì không,
 * nên để cuối chỉ phòng khi họ bật CORS sau này).
 */
function candidateUrls(dir: string, file: string): string[] {
  const f = encodeURIComponent(thumbName(file)) + '.png';
  return [
    `https://raw.githubusercontent.com/libretro-thumbnails/${encodeURIComponent(dir.replace(/ /g, '_'))}/master/Named_Boxarts/${f}`,
    `https://thumbnails.libretro.com/${encodeURIComponent(dir)}/Named_Boxarts/${f}`,
  ];
}

/** Tải ảnh bìa gốc. Trả về null nếu không có (sai tên, ngoại tuyến, hoặc bị chặn). */
export async function fetchBoxArt(systemId: string, fileBase: string): Promise<Blob | null> {
  const dir = SYSTEM_DIRS[systemId];
  if (!dir) return null;
  for (const url of candidateUrls(dir, fileBase)) {
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit' });
      if (!res.ok) continue;
      const blob = await res.blob();
      if (!blob.type.startsWith('image/')) continue;
      const cover = await toCoverBlob(blob);
      if (cover) return cover;
    } catch {
      /* thử nguồn tiếp theo */
    }
  }
  return null;
}

/** Thu nhỏ ảnh (cạnh dài tối đa maxSide) và nén JPEG. */
export async function toCoverBlob(src: Blob, maxSide = 320): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(src);
    const k = Math.min(1, maxSide / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * k));
    const h = Math.max(1, Math.round(bmp.height * k));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0, w, h);
    bmp.close();
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  } catch {
    return null;
  }
}
