---
name: gnome-dev-workflow
description: >-
  Quy trình phát triển, debugging và đóng gói GNOME Shell Extension: development
  cycle, restart GNOME Shell, nested session, journalctl logging, Looking Glass
  debugger, common errors, testing strategies, symlink development, packaging zip,
  gnome-extensions CLI, troubleshooting. Dùng khi cài đặt, chạy, debug, test,
  package extension, hoặc khi đề cập đến development workflow, debugging, logs,
  packaging, publishing, troubleshooting.
---

# Quy Trình Phát Triển, Debugging & Đóng Gói

## 1. Development Cycle

```text
1. Chỉnh sửa source files
   (extension.js, prefs.js, stylesheet.css, gschema.xml)
        │
        ▼
2. Nếu thay đổi schema → glib-compile-schemas schemas/
        │
        ▼
3. Restart GNOME Shell
   ─────────────────────
   Wayland: Log out → Log in
   X11:     Alt+F2 → 'r' → Enter
        │
        ▼
4. Kiểm tra logs: journalctl -f -o cat /usr/bin/gnome-shell
        │
        ▼
5. Test chức năng (hạ threshold, kiểm tra edge cases)
```

## 2. Cài Đặt Phát Triển (Symlink)

Thay vì copy file mỗi lần thay đổi, tạo symlink từ thư mục phát triển:

```bash
# Clone repository
git clone https://github.com/author/my-extension.git
cd my-extension

# Compile schema
glib-compile-schemas schemas/

# Tạo symlink vào thư mục extensions
ln -sf "$(pwd)" \
  ~/.local/share/gnome-shell/extensions/my-extension@author.domain

# Enable extension
gnome-extensions enable my-extension@author.domain
```

## 3. Restart GNOME Shell

| Môi trường | Cách restart |
|------------|-------------|
| **Wayland** | Log out → Log back in (không có cách restart nhanh) |
| **X11** | `Alt+F2` → gõ `r` → Enter |

### Nested GNOME Shell (Chỉ X11)

Mở GNOME Shell bên trong session hiện tại để test cô lập:

```bash
dbus-run-session -- gnome-shell --nested --wayland
```

## 4. Logging & Debug Output

### Ghi Log Trong Extension

```javascript
// Log thông thường (hiện trong journal)
console.log('MyExtension: some info', variable);

// Log lỗi (có stack trace)
try {
  // ...
} catch (e) {
  logError(e, 'MyExtension: failed to do something');
}
```

### Xem Log

```bash
# Tất cả log GNOME Shell (real-time)
journalctl -f -o cat /usr/bin/gnome-shell

# Lọc chỉ log của extension
journalctl -f -o cat /usr/bin/gnome-shell | grep -i "MyExtension"

# Log 5 phút gần nhất
journalctl --since "5 min ago" -o cat /usr/bin/gnome-shell
```

## 5. Looking Glass (Built-in Debugger)

Mở bằng `Alt+F2` → gõ `lg` → Enter. Đây là console JavaScript chạy trực tiếp trong GNOME Shell process.

### Lệnh Hữu Ích

```javascript
// Kiểm tra extension đã load chưa
imports.misc.extensionUtils.extensions['my-extension@author.domain']

// Kiểm tra trạng thái nội bộ
ext._dialogOpen
ext._coolingDown

// Gọi method thủ công
ext._checkMemory()

// Reload stylesheet (không cần restart shell)
St.ThemeContext.get_for_stage(global.stage)
  .get_theme()
  .load_stylesheet(Gio.File.new_for_path('/path/to/stylesheet.css'));
```

## 6. Lỗi Phổ Biến & Cách Xử Lý

| Thông báo lỗi | Nguyên nhân | Cách sửa |
|---------------|------------|----------|
| `GLib.Error: ... no such schema` | Schema chưa compile | `glib-compile-schemas schemas/` |
| `TypeError: ... is not a constructor` | Thiếu `GObject.registerClass()` | Bọc class bằng `GObject.registerClass()` |
| `Error: Unable to create modal dialog` | Tạo dialog trong `disable()` | Kiểm tra flag trước khi tạo |
| `GLib-GObject: ... invalid property name` | Sai tên key GSettings | Kiểm tra key trong `gschema.xml` |
| `Extension ... had error: SyntaxError` | Lỗi cú pháp JavaScript | Xem `journalctl` để tìm file/dòng |
| `ReferenceError: St is not defined` | Import `St` trong `prefs.js` | `St` chỉ khả dụng trong `extension.js` |
| `Error: No signal 'changed::...'` | Tên signal sai | Dùng `changed::key-name` (hai dấu `::`) |

## 7. Testing Strategies

### Trigger Nhanh Để Test

```bash
# Hạ threshold xuống 1% để dialog hiện ngay
gsettings --schemadir schemas/ set \
  org.gnome.shell.extensions.my-extension some-threshold 1

# Test xong thì reset
gsettings --schemadir schemas/ reset-recursively \
  org.gnome.shell.extensions.my-extension
```

### Edge Cases Cần Test

| Scenario | Cách test | Kỳ vọng |
|----------|----------|---------|
| Bật/tắt nhanh | Toggle extension liên tục | Không crash, không orphaned timers |
| Khóa màn hình | Lock screen khi dialog đang mở | Dialog đóng, timers bị remove |
| Threshold = 100% | Set max | Không bao giờ trigger |
| Threshold = min | Set min | Trigger ngay lập tức |
| Settings thay đổi runtime | Đổi settings khi extension đang chạy | Extension phản hồi đúng |

### Test Preferences UI

```bash
# Mở preferences trực tiếp
gnome-extensions prefs my-extension@author.domain

# Hoặc mở GNOME Extensions app
gnome-extensions-app
```

## 8. gnome-extensions CLI

```bash
# Liệt kê tất cả extensions
gnome-extensions list

# Thông tin chi tiết
gnome-extensions info my-extension@author.domain

# Enable / Disable
gnome-extensions enable my-extension@author.domain
gnome-extensions disable my-extension@author.domain

# Cài đặt từ file zip
gnome-extensions install my-extension@author.domain.zip --force

# Mở preferences
gnome-extensions prefs my-extension@author.domain
```

## 9. Đóng Gói & Phân Phối

### Tạo File .zip

Chỉ đóng gói các file cần thiết (loại bỏ `.git`, docs, dev files):

```bash
zip -r my-extension@author.domain.zip \
  metadata.json \
  extension.js \
  prefs.js \
  stylesheet.css \
  schemas/
```

Nếu có thư mục locale (đa ngôn ngữ):

```bash
zip -r my-extension@author.domain.zip \
  metadata.json \
  extension.js \
  prefs.js \
  stylesheet.css \
  schemas/ \
  locale/
```

### Validate Trước Khi Publish

```bash
# Kiểm tra metadata.json hợp lệ
python3 -c "
import json
with open('metadata.json') as f:
    meta = json.load(f)
    assert 'uuid' in meta
    assert 'shell-version' in meta
    assert 'name' in meta
    print('✅ metadata.json is valid')
"

# Kiểm tra schema compile thành công
glib-compile-schemas --strict schemas/
echo "✅ Schema compiles successfully"
```

### Cập Nhật Phiên Bản

Trước khi publish, tăng `version` trong `metadata.json`:

```json
{
  "version": 2
}
```

## 10. Troubleshooting

### Extension Không Load

```bash
gnome-extensions list | grep my-extension
journalctl -o cat /usr/bin/gnome-shell | grep -i "my-extension" | tail -20
ls -la ~/.local/share/gnome-shell/extensions/my-extension@author.domain
```

### Extension Gây Crash GNOME Shell

```bash
# Chuyển sang TTY (Ctrl+Alt+F3) rồi disable
gnome-extensions disable my-extension@author.domain

# Hoặc xóa symlink
rm ~/.local/share/gnome-shell/extensions/my-extension@author.domain

# Restart GNOME Shell
# Wayland: systemctl restart gdm
# X11:     killall -3 gnome-shell
```

### Preferences Không Mở

```bash
# Xem lỗi prefs.js
gnome-extensions prefs my-extension@author.domain 2>&1
journalctl -o cat /usr/bin/gnome-shell-extension-prefs | tail -20
```

## 11. Checklist

- [ ] Schema compile thành công (`glib-compile-schemas --strict schemas/`).
- [ ] Extension enable/disable không gây crash hay leak.
- [ ] Logs không có error hay warning nghiêm trọng.
- [ ] Preferences window mở và hoạt động đúng.
- [ ] Đã test trên các phiên bản GNOME Shell được khai báo trong `metadata.json`.
- [ ] File `.zip` chỉ chứa các file cần thiết, không chứa `.git` hay dev files.
