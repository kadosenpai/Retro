# Retro

Web chơi game retro (giai đoạn 1: Game Boy Advance) bằng mGBA (libretro) biên dịch ra Wasm.

## Chạy

```
npm install
npm run dev        # phát triển (cổng 5173)
npm run build      # đóng gói vào dist/
npm run preview    # chạy thử bản đóng gói (cổng 4173), có PWA/offline
```

## Nhân giả lập

Cần hai file trong `public/cores/mgba/`: `mgba_libretro.js` và `mgba_libretro.wasm`.
Chúng được build bằng `core-build/build.sh` (qua GitHub Actions) — xem thư mục `core-build/`.
Khi thay nhân mà giữ nguyên tên file, tăng `VERSION` trong `public/sw.js`.

## Cấu trúc

- `src/engine`   Worker giả lập, cầu nối Wasm, bộ định nhịp khung hình
- `src/render`   WebGL / Canvas 2D
- `src/audio`    Âm thanh độ trễ thấp (SharedArrayBuffer + AudioWorklet)
- `src/input`    Bàn phím, tay cầm, nút ảo cảm ứng
- `src/storage`  IndexedDB: ROM, save, save state, cài đặt, cheat, ảnh bìa
- `src/systems`  Hồ sơ từng hệ máy (hiện có GBA)
- `src/ui`       Màn hình thư viện, menu, các bảng cài đặt
- `src/pwa`      Đăng ký Service Worker
- `public/_headers`  COOP/COEP cho Cloudflare Pages (bắt buộc cho SharedArrayBuffer)

ROM do người dùng tự cung cấp, chỉ lưu trong trình duyệt.
