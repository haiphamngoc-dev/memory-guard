---
name: gnome-extension-core
description: >-
  Kiến trúc và lifecycle GNOME Shell Extension (GNOME 45+ ESM): cấu trúc
  project, metadata.json, extension.js, prefs.js, GObject.registerClass,
  import patterns, enable/disable lifecycle, Panel Indicator, Modal Dialog,
  polling timers, async I/O. Dùng khi tạo mới hoặc chỉnh sửa extension.js,
  prefs.js, metadata.json, khi viết GObject class, Panel Indicator, Modal Dialog,
  hoặc khi đề cập đến GNOME Shell Extension, lifecycle, enable, disable.
---

# Kiến Trúc & Lifecycle GNOME Shell Extension

## 1. Cấu Trúc Project Chuẩn

```text
my-extension@author.domain/
├── metadata.json           # Định danh extension & tương thích GNOME Shell
├── extension.js            # Logic chính (chạy trong gnome-shell process)
├── prefs.js                # UI cài đặt (chạy trong process riêng)
├── stylesheet.css          # St CSS cho giao diện trong shell
└── schemas/
    ├── org.gnome.shell.extensions.my-extension.gschema.xml
    └── gschemas.compiled   # File nhị phân (auto-generated, phải commit)
```

## 2. metadata.json

Mọi extension bắt buộc phải có file `metadata.json` hợp lệ:

```json
{
  "name": "My Extension",
  "description": "Mô tả ngắn gọn chức năng của extension.",
  "uuid": "my-extension@author.domain",
  "shell-version": ["45", "46", "47", "48"],
  "settings-schema": "org.gnome.shell.extensions.my-extension",
  "url": "https://github.com/author/my-extension",
  "version": 1
}
```

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| `name` | ✅ | Tên hiển thị của extension |
| `uuid` | ✅ | Định danh duy nhất `<name>@<domain>` |
| `shell-version` | ✅ | Mảng phiên bản GNOME Shell tương thích |
| `description` | ✅ | Mô tả chức năng |
| `settings-schema` | ❌ | ID schema GSettings (nếu có preferences) |
| `url` | ❌ | URL mã nguồn |
| `version` | ❌ | Số phiên bản (tăng dần khi release) |
| `gettext-domain` | ❌ | Domain cho đa ngôn ngữ (gettext) |

## 3. Import Patterns (GNOME 45+ ESM)

Có 3 loại import cần phân biệt rõ ràng:

### A. GI (GObject Introspection) Imports — Thư viện hệ thống

```javascript
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import St from 'gi://St';           // Chỉ dùng trong extension.js
import Clutter from 'gi://Clutter'; // Chỉ dùng trong extension.js
import Adw from 'gi://Adw';         // Chỉ dùng trong prefs.js
import Gtk from 'gi://Gtk';         // Chỉ dùng trong prefs.js
```

### B. Shell Internal Imports — Module nội bộ GNOME Shell

```javascript
// Chỉ khả dụng trong extension.js (gnome-shell process)
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as ModalDialog from 'resource:///org/gnome/shell/ui/modalDialog.js';
```

### C. Extension Base Class Imports

```javascript
// Trong extension.js:
import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';

// Trong prefs.js:
import { ExtensionPreferences } from
  'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
```

## 4. Extension Lifecycle: enable() / disable()

Đây là hai method quan trọng nhất. GNOME Shell gọi `enable()` khi bật extension và `disable()` khi tắt, khóa màn hình (GNOME 42+), hoặc restart shell.

```javascript
export default class MyExtension extends Extension {
  enable() {
    this._settings = this.getSettings();
    // Khởi tạo tài nguyên: timers, indicators, signals...
  }

  disable() {
    // BẮT BUỘC: Giải phóng MỌI tài nguyên đã tạo trong enable()
    this._settings = null;
  }
}
```

### Quy tắc Cleanup trong disable() — TUYỆT ĐỐI BẮT BUỘC

| Tài nguyên | Cách cleanup | Ví dụ |
|------------|-------------|-------|
| GLib timer | `GLib.source_remove(sourceId)` | `GLib.source_remove(this._timerId)` |
| GSettings signal | `settings.disconnect(handlerId)` | `this._settings.disconnect(this._settingsChangedId)` |
| Panel indicator | `indicator.destroy()` | `this._indicator.destroy()` |
| Modal dialog | `dialog.close()` | `this._dialog.close()` |
| Object references | Gán `null` | `this._settings = null` |

**Lý do**: Nếu không cleanup, sẽ gây memory leak, orphaned timers, hoặc crash khi GNOME Shell gọi `disable()` lúc khóa màn hình.

### Mẫu Tracking Source IDs

Mỗi khi tạo GLib timer, luôn lưu source ID để có thể remove trong `disable()`:

```javascript
enable() {
  this._loopSourceId = GLib.timeout_add_seconds(
    GLib.PRIORITY_DEFAULT, interval,
    () => {
      this._doWork();
      return GLib.SOURCE_CONTINUE; // Lặp lại
    }
  );
}

disable() {
  if (this._loopSourceId) {
    GLib.source_remove(this._loopSourceId);
    this._loopSourceId = 0;
  }
}
```

## 5. GObject Type System

Khi extend các class GObject của GNOME Shell (ModalDialog, PanelMenu.Button...), **bắt buộc** phải đăng ký class với `GObject.registerClass()`:

```javascript
const MyDialog = GObject.registerClass(
  class MyDialog extends ModalDialog.ModalDialog {
    constructor(params) {
      super({ styleClass: 'my-dialog', destroyOnClose: true });
      // Xây dựng nội dung dialog...
    }
  }
);
```

**Tại sao?** GNOME Shell dùng GObject signals và properties bên trong. Không đăng ký sẽ gây crash: `TypeError: ... is not a constructor`.

## 6. Panel Indicator Pattern

Tạo nút trên top panel với menu dropdown:

```javascript
const MyIndicator = GObject.registerClass(
  class MyIndicator extends PanelMenu.Button {
    _init(extensionObject) {
      super._init(0.0, 'My Indicator');
      this._extensionObject = extensionObject;

      // Layout: icon + label
      const box = new St.BoxLayout({
        style_class: 'panel-status-indicators-box',
      });
      this._icon = new St.Icon({
        icon_name: 'dialog-information-symbolic',
        icon_size: 16,
        style_class: 'system-status-icon',
      });
      this._label = new St.Label({
        text: 'Status',
        y_align: Clutter.ActorAlign.CENTER,
      });
      box.add_child(this._icon);
      box.add_child(this._label);
      this.add_child(box);

      // Dropdown menu items
      const statusItem = new PopupMenu.PopupMenuItem('Info', { reactive: false });
      this.menu.addMenuItem(statusItem);
      this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

      const prefsItem = new PopupMenu.PopupMenuItem('Preferences');
      prefsItem.connect('activate', () => {
        this._extensionObject.openPreferences();
      });
      this.menu.addMenuItem(prefsItem);
    }
  }
);

// Trong enable():
this._indicator = new MyIndicator(this);
Main.panel.addToStatusArea('my-extension', this._indicator);

// Trong disable():
this._indicator?.destroy();
this._indicator = null;
```

## 7. Modal Dialog Pattern

Hiển thị dialog cảnh báo dạng modal (chặn tương tác):

```javascript
const WarningDialog = GObject.registerClass(
  class WarningDialog extends ModalDialog.ModalDialog {
    constructor({ message, onClose }) {
      super({ styleClass: 'my-warning-dialog', destroyOnClose: true });
      this._onClose = onClose;

      const contentBox = new St.BoxLayout({
        vertical: true,
        x_align: Clutter.ActorAlign.CENTER,
      });
      contentBox.add_child(new St.Label({ text: message }));
      this.contentLayout.add_child(contentBox);

      this.addButton({
        label: 'OK',
        action: () => {
          this.close();
          this._onClose?.();
        },
        default: true,
      });
    }
  }
);
```

## 8. Async File I/O

Đọc file bất đồng bộ trong GJS bằng `Gio._promisify`:

```javascript
// Promisify một lần ở đầu file
Gio._promisify(Gio.File.prototype,
  'load_contents_async', 'load_contents_finish');

// Sử dụng async/await
async _readFile(path) {
  try {
    const file = Gio.File.new_for_path(path);
    const [contents] = await file.load_contents_async(null);
    return new TextDecoder().decode(contents);
  } catch (e) {
    logError(e, 'Failed to read file');
    return null;
  }
}
```

## 9. Guard Flags Pattern

Tránh xung đột giữa các lần kiểm tra đồng thời hoặc hiển thị dialog trùng lặp:

```javascript
enable() {
  this._checking = false;   // Đang chạy kiểm tra?
  this._dialogOpen = false;  // Dialog đang hiển thị?
  this._coolingDown = false; // Đang trong thời gian chờ?
}

async _check() {
  if (this._checking) return; // Tránh chạy song song
  this._checking = true;
  try {
    // ... logic kiểm tra
    if (this._dialogOpen || this._coolingDown) return;
    // ... hiển thị dialog nếu cần
  } finally {
    this._checking = false;
  }
}
```

## 10. Checklist

- [ ] `metadata.json` có đủ các trường bắt buộc (`name`, `uuid`, `shell-version`, `description`).
- [ ] `extension.js` export default class kế thừa `Extension`.
- [ ] `disable()` giải phóng **MỌI** tài nguyên: GLib sources, signals, indicators, dialogs, references.
- [ ] Mọi GObject class extend từ Shell class đều được bọc trong `GObject.registerClass()`.
- [ ] Không import module `St`/`Clutter` trong `prefs.js` (sẽ crash).
- [ ] Không import module `Adw`/`Gtk` trong `extension.js` (không khả dụng).
- [ ] Mọi GLib timer đều lưu source ID để cleanup trong `disable()`.
