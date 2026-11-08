/** Tiện ích cho file save thô (.sav/.srm) — định dạng chung của mGBA, RetroArch, máy thật... */

const MAX_SAV_BYTES = 256 * 1024;

/** Tên file tải về: bỏ ký tự không hợp lệ trong tên file. */
export function savFileName(romName: string): string {
  const clean = romName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').trim() || 'game';
  return clean + '.sav';
}

/** Trả về thông báo lỗi nếu file không thể là save hợp lệ, ngược lại null. */
export function validateSav(buf: ArrayBuffer): string | null {
  if (buf.byteLength === 0) return 'File rỗng';
  if (buf.byteLength > MAX_SAV_BYTES) return 'File quá lớn để là file save (tối đa 256 KB)';
  return null;
}

/** Tải một buffer về máy dưới dạng file. */
export function downloadBytes(data: ArrayBuffer, fileName: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([data], { type: 'application/octet-stream' }));
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
}
