# Quy tắc Chung — GNOME Shell Extension

## Loại Dự Án

Đây là **GNOME Shell Extension** (GNOME 45+), KHÔNG phải web app, Node.js app, hay ứng dụng desktop thông thường.

## Quy tắc Bắt Buộc

- **Không có bundler hay package manager**: Không có `node_modules`, `package.json`, `npm`, `pnpm`, `yarn`. Extension chạy hoàn toàn trên các thư viện tích hợp sẵn của GNOME Shell (`GLib`, `GObject`, `St`, `Clutter`, `Gio`, `Adw`, `Gtk`).
- **Module system**: ESM (`import` / `export`). Không sử dụng `imports.*` (legacy GJS).
- **Ngôn ngữ**: JavaScript (GJS). Không sử dụng TypeScript.
- **Comment và JSDoc**: Bắt buộc viết bằng **tiếng Anh (English)**.
- **UUID convention**: `<extension-name>@<author-domain>`.
- **Hai process riêng biệt**:
  - `extension.js` chạy trong `gnome-shell` process — có quyền truy cập `St`, `Clutter`, `ModalDialog`, `PanelMenu`.
  - `prefs.js` chạy trong `gnome-extensions-app` process — có quyền truy cập `Adw`, `Gtk`.
  - Hai file này **KHÔNG THỂ** truyền biến trực tiếp cho nhau. Chia sẻ dữ liệu chỉ thông qua **GSettings**.
- **Không dùng API web**: Không có `document`, `window`, `DOM`, `fetch`, `XMLHttpRequest`, `localStorage`. GNOME Shell extension không chạy trong trình duyệt.
