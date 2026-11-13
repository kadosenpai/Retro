/**
 * Đổi Blob ảnh nhỏ thành data URL. Khác với URL.createObjectURL, data URL không bao giờ
 * bị thu hồi nên không thể thành "ảnh vỡ" khi danh sách làm mới (iOS Safari hay gặp lỗi này).
 */
export function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === 'string' ? r.result : null);
    r.onerror = () => resolve(null);
    r.readAsDataURL(blob);
  });
}
