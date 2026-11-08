/** Đăng ký Service Worker (chỉ bản build thật; chạy dev thì bỏ qua để khỏi bị cache gây rối). */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {
      /* không đăng ký được thì web vẫn chạy bình thường, chỉ không offline */
    });
  });
}
