---
name: gsettings-schema
description: >-
  GSettings schema và Preferences UI cho GNOME Shell Extension: định nghĩa
  gschema.xml, compile schema, Adw widgets (SpinRow, SwitchRow, ComboRow),
  settings binding, runtime change listening, CLI management, quy trình
  thêm setting mới. Dùng khi chỉnh sửa gschema.xml, prefs.js, thêm/sửa
  settings, hoặc khi đề cập đến GSettings, preferences, schema, gsettings.
---

# GSettings Schema & Preferences UI

## 1. Cấu Trúc File GSettings Schema

File schema nằm tại `schemas/org.gnome.shell.extensions.<extension-name>.gschema.xml`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<schemalist gettext-domain="my-extension">

  <schema id="org.gnome.shell.extensions.my-extension"
    path="/org/gnome/shell/extensions/my-extension/">

    <!-- Kiểu integer có giới hạn -->
    <key name="check-interval" type="i">
      <default>5</default>
      <summary>Check Interval (seconds)</summary>
      <description>How often to perform the check, in seconds.</description>
      <range min="1" max="60" />
    </key>

    <!-- Kiểu boolean -->
    <key name="show-indicator" type="b">
      <default>true</default>
      <summary>Show Panel Indicator</summary>
      <description>Whether to show an indicator in the top panel.</description>
    </key>

    <!-- Kiểu string -->
    <key name="display-format" type="s">
      <default>'percent'</default>
      <summary>Display Format</summary>
      <description>How to display values: 'percent' or 'absolute'.</description>
    </key>

    <!-- Kiểu double (số thực) -->
    <key name="opacity-level" type="d">
      <default>0.8</default>
      <summary>Opacity Level</summary>
      <description>Opacity level for the overlay (0.0 to 1.0).</description>
      <range min="0.0" max="1.0" />
    </key>

    <!-- Kiểu array of strings -->
    <key name="excluded-apps" type="as">
      <default>[]</default>
      <summary>Excluded Applications</summary>
      <description>List of application IDs to exclude.</description>
    </key>

  </schema>

</schemalist>
```

### Các Kiểu Dữ Liệu GSettings

| Type | Ký hiệu | Ví dụ default | Getter / Setter |
|------|---------|---------------|-----------------|
| Integer | `i` | `42` | `get_int()` / `set_int()` |
| Boolean | `b` | `true` | `get_boolean()` / `set_boolean()` |
| String | `s` | `'value'` | `get_string()` / `set_string()` |
| Double | `d` | `3.14` | `get_double()` / `set_double()` |
| String Array | `as` | `['a','b']` | `get_strv()` / `set_strv()` |

### Quy Ước Đặt Tên Key

- Sử dụng `kebab-case`: `memory-threshold`, `check-interval`, `show-indicator`
- Không dùng camelCase hay snake_case

## 2. Compile Schema

**Bắt buộc** chạy sau mỗi lần thay đổi file XML:

```bash
glib-compile-schemas schemas/
```

File `gschemas.compiled` được tạo ra — **phải commit cả hai file** (`.xml` và `.compiled`) vào repository. GNOME Shell đọc file binary `.compiled`, không đọc file XML trực tiếp.

Kiểm tra lỗi nghiêm ngặt:

```bash
glib-compile-schemas --strict schemas/
```

## 3. Sử Dụng GSettings Trong extension.js

```javascript
enable() {
  // Lấy settings từ Extension base class
  this._settings = this.getSettings();

  // Đọc giá trị
  const threshold = this._settings.get_int('memory-threshold');
  const showIndicator = this._settings.get_boolean('show-indicator');

  // Lắng nghe thay đổi runtime
  this._settingsChangedId = this._settings.connect(
    'changed::show-indicator', () => {
      const newValue = this._settings.get_boolean('show-indicator');
      // Phản hồi thay đổi...
    }
  );
}

disable() {
  // BẮT BUỘC: Ngắt kết nối signal
  if (this._settingsChangedId) {
    this._settings.disconnect(this._settingsChangedId);
    this._settingsChangedId = 0;
  }
  this._settings = null;
}
```

## 4. Preferences UI (prefs.js)

File `prefs.js` chạy trong process riêng, sử dụng `Adw` và `Gtk`:

```javascript
import Adw from 'gi://Adw';
import Gtk from 'gi://Gtk';
import Gio from 'gi://Gio';
import { ExtensionPreferences } from
  'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MyPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const settings = this.getSettings();

    // Tạo page
    const page = new Adw.PreferencesPage({
      title: 'Settings',
      icon_name: 'preferences-system-symbolic',
    });
    window.add(page);

    // Tạo group
    const group = new Adw.PreferencesGroup({
      title: 'General',
      description: 'Configure general settings.',
    });
    page.add(group);

    // SpinRow cho giá trị số
    const spinRow = new Adw.SpinRow({
      title: 'Check Interval',
      subtitle: 'Seconds between each check (1-60)',
      adjustment: new Gtk.Adjustment({
        lower: 1, upper: 60,
        step_increment: 1, page_increment: 5,
        value: settings.get_int('check-interval'),
      }),
    });
    settings.bind('check-interval', spinRow, 'value',
      Gio.SettingsBindFlags.DEFAULT);
    group.add(spinRow);

    // SwitchRow cho boolean
    const switchRow = new Adw.SwitchRow({
      title: 'Show Indicator',
      subtitle: 'Display status in the top panel',
    });
    settings.bind('show-indicator', switchRow, 'active',
      Gio.SettingsBindFlags.DEFAULT);
    group.add(switchRow);

    window.set_default_size(450, 500);
  }
}
```

### Các Adw Widget Thường Dùng

| Widget | Mục đích | Property binding |
|--------|---------|------------------|
| `Adw.SpinRow` | Giá trị số (có spinner) | `'value'` |
| `Adw.SwitchRow` | Bật/tắt boolean | `'active'` |
| `Adw.ComboRow` | Danh sách lựa chọn | `'selected'` |
| `Adw.EntryRow` | Nhập chuỗi văn bản | `'text'` |
| `Adw.ExpanderRow` | Nhóm mở rộng/thu gọn | `'enable-expansion'` |
| `Adw.PasswordEntryRow` | Nhập mật khẩu | `'text'` |

### Settings Binding

`settings.bind()` tạo **two-way binding** — thay đổi UI cập nhật GSettings ngay lập tức, và ngược lại:

```javascript
settings.bind('key-name', widget, 'property',
  Gio.SettingsBindFlags.DEFAULT);
```

## 5. Quản Lý GSettings Từ CLI

```bash
# Xem tất cả settings
gsettings --schemadir schemas/ list-recursively \
  org.gnome.shell.extensions.my-extension

# Đọc giá trị
gsettings --schemadir schemas/ get \
  org.gnome.shell.extensions.my-extension check-interval

# Ghi giá trị
gsettings --schemadir schemas/ set \
  org.gnome.shell.extensions.my-extension check-interval 10

# Reset về mặc định
gsettings --schemadir schemas/ reset \
  org.gnome.shell.extensions.my-extension check-interval

# Reset TẤT CẢ về mặc định
gsettings --schemadir schemas/ reset-recursively \
  org.gnome.shell.extensions.my-extension

# Theo dõi thay đổi (real-time)
gsettings --schemadir schemas/ monitor \
  org.gnome.shell.extensions.my-extension
```

## 6. Quy Trình Thêm Setting Mới

1. **Thêm key vào `gschema.xml`** — định nghĩa type, default, summary, description, range
2. **Compile schema**: `glib-compile-schemas schemas/`
3. **Sử dụng trong `extension.js`**: `this._settings.get_int('new-key')`
4. **Thêm UI trong `prefs.js`**: Tạo Adw widget + `settings.bind()`
5. **Commit cả `.xml` và `.compiled`**

## 7. Checklist

- [ ] File `gschema.xml` hợp lệ (có `<schema>`, `<key>`, `<default>` cho mỗi key).
- [ ] Schema đã được compile sau thay đổi (`glib-compile-schemas schemas/`).
- [ ] Commit cả file `.xml` lẫn `.compiled`.
- [ ] Tên key sử dụng `kebab-case`.
- [ ] Mỗi key trong schema đều có UI tương ứng trong `prefs.js`.
- [ ] `settings.bind()` dùng đúng property name cho mỗi widget.
- [ ] Signal `changed::key-name` được disconnect trong `disable()`.
