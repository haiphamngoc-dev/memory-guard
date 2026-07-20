---
name: gettext-i18n
description: >-
  Đa ngôn ngữ (i18n) cho GNOME Shell Extension bằng Gettext: gettext-domain,
  cấu trúc thư mục locale, tạo .pot/.po/.mo, xgettext, msginit, msgmerge,
  msgfmt, sử dụng gettext trong extension.js và prefs.js (ESM GNOME 45+).
  Dùng khi thêm/sửa chuỗi dịch, file locale, .po, .pot, hoặc khi đề cập
  đến i18n, translations, đa ngôn ngữ, gettext, locales, dịch.
---

# Đa Ngôn Ngữ Với Gettext (GNOME Shell Extension)

## 1. Khai Báo Gettext Domain

Trong `metadata.json`, thêm trường `gettext-domain` để GNOME Shell tự động khởi tạo translations:

```json
{
  "uuid": "my-extension@author.domain",
  "gettext-domain": "my-extension@author.domain",
  "shell-version": ["45", "46", "47", "48"]
}
```

Nếu có schema, đồng bộ `gettext-domain` trong `gschema.xml`:

```xml
<schemalist gettext-domain="my-extension@author.domain">
```

## 2. Cấu Trúc Thư Mục Locale

```text
my-extension@author.domain/
├── po/
│   ├── POTFILES.in              # Danh sách file chứa chuỗi cần dịch
│   ├── LINGUAS                  # Danh sách ngôn ngữ được hỗ trợ
│   ├── my-extension.pot         # Template gốc (auto-generated)
│   ├── vi.po                    # Bản dịch tiếng Việt
│   └── fr.po                    # Bản dịch tiếng Pháp
├── locale/                      # Thư mục bản dịch đã compile
│   ├── vi/
│   │   └── LC_MESSAGES/
│   │       └── my-extension@author.domain.mo
│   └── fr/
│       └── LC_MESSAGES/
│           └── my-extension@author.domain.mo
└── ...
```

### File POTFILES.in

Liệt kê tất cả file chứa chuỗi cần dịch:

```text
extension.js
prefs.js
```

### File LINGUAS

Liệt kê các ngôn ngữ được hỗ trợ (mỗi dòng một mã ngôn ngữ):

```text
vi
fr
```

## 3. Quy Trình Tạo & Quản Lý Bản Dịch

### Bước 1: Trích Xuất Chuỗi Cần Dịch (Tạo .pot)

```bash
xgettext \
  --from-code=UTF-8 \
  --language=JavaScript \
  --keyword=_ \
  --keyword=ngettext:1,2 \
  --keyword=pgettext:1c,2 \
  --output=po/my-extension.pot \
  extension.js prefs.js
```

### Bước 2: Tạo Bản Dịch Mới (Tạo .po)

```bash
# Tạo bản dịch tiếng Việt
msginit \
  --locale=vi \
  --input=po/my-extension.pot \
  --output=po/vi.po
```

### Bước 3: Dịch Thuật

Mở file `.po` và dịch các chuỗi `msgstr`:

```po
#: extension.js:95
msgid "System Warning"
msgstr "Cảnh Báo Hệ Thống"

#: extension.js:109
msgid "Memory consumption has exceeded the configured threshold."
msgstr "Mức tiêu thụ bộ nhớ đã vượt ngưỡng cấu hình."
```

### Bước 4: Cập Nhật Bản Dịch Khi Có Chuỗi Mới

```bash
# Cập nhật template
xgettext --from-code=UTF-8 --language=JavaScript \
  --keyword=_ --output=po/my-extension.pot \
  extension.js prefs.js

# Merge chuỗi mới vào bản dịch hiện tại
msgmerge --update po/vi.po po/my-extension.pot
```

### Bước 5: Compile Bản Dịch (Tạo .mo)

```bash
# Tạo thư mục locale
mkdir -p locale/vi/LC_MESSAGES

# Compile
msgfmt po/vi.po \
  --output-file=locale/vi/LC_MESSAGES/my-extension@author.domain.mo
```

## 4. Sử Dụng Gettext Trong Code (GNOME 45+ ESM)

### Trong extension.js

```javascript
import { Extension, gettext as _ }
  from 'resource:///org/gnome/shell/extensions/extension.js';

export default class MyExtension extends Extension {
  enable() {
    // Sử dụng _() để bọc chuỗi cần dịch
    console.log(_('Extension enabled'));
  }

  _showWarning() {
    const title = new St.Label({
      text: _('System Warning'),
    });

    const body = new St.Label({
      text: _('Memory consumption has exceeded the configured threshold.'),
    });
  }
}
```

### Trong prefs.js

```javascript
import { ExtensionPreferences, gettext as _ }
  from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class MyPreferences extends ExtensionPreferences {
  fillPreferencesWindow(window) {
    const page = new Adw.PreferencesPage({
      title: _('Settings'),
      icon_name: 'preferences-system-symbolic',
    });

    const group = new Adw.PreferencesGroup({
      title: _('Warning Thresholds'),
      description: _('Set the percentage at which a warning appears.'),
    });

    const row = new Adw.SpinRow({
      title: _('Check Interval'),
      subtitle: _('Seconds between each check'),
    });
  }
}
```

### Chuỗi Số Nhiều (Plural Forms)

```javascript
import { Extension, gettext as _, ngettext }
  from 'resource:///org/gnome/shell/extensions/extension.js';

// ngettext(singular, plural, count)
const msg = ngettext(
  '%d process is using too much memory',
  '%d processes are using too much memory',
  count
).format(count);
```

### Chuỗi Có Ngữ Cảnh (Context)

```javascript
import { Extension, pgettext }
  from 'resource:///org/gnome/shell/extensions/extension.js';

// pgettext(context, string) — phân biệt cùng chuỗi nhưng khác ngữ cảnh
const label = pgettext('button', 'Close');    // Nút đóng
const title = pgettext('dialog', 'Close');    // Tiêu đề đóng
```

## 5. Quy Tắc Bắt Buộc

- ✅ **Mọi chuỗi hiển thị cho người dùng** phải được bọc trong `_()` hoặc `ngettext()` hoặc `pgettext()`.
- ✅ Khi thêm chuỗi mới → cập nhật `.pot` → merge vào `.po` → compile `.mo`.
- ✅ Đồng bộ `gettext-domain` giữa `metadata.json` và `gschema.xml`.
- ❌ **KHÔNG dịch**: Log messages, error codes, GSettings key names, tên file, tên biến.
- ❌ **KHÔNG ghép chuỗi** bằng `+` — dùng format placeholders để translator có thể thay đổi thứ tự từ:
  - ✅ `_('Usage: %s%%').format(value)`
  - ❌ `_('Usage: ') + value + '%'`

## 6. Đóng Gói Với Locale

Khi đóng gói file `.zip`, bao gồm cả thư mục `locale/`:

```bash
zip -r my-extension@author.domain.zip \
  metadata.json extension.js prefs.js stylesheet.css \
  schemas/ locale/
```

## 7. Checklist

- [ ] `gettext-domain` được khai báo trong `metadata.json`.
- [ ] Mọi chuỗi hiển thị UI đều được bọc trong `_()`.
- [ ] File `.pot` đã được cập nhật với tất cả chuỗi mới.
- [ ] Mỗi file `.po` đã được merge với `.pot` mới nhất.
- [ ] File `.mo` đã được compile từ `.po`.
- [ ] Không ghép chuỗi bằng `+` — dùng format placeholders.
- [ ] Thư mục `locale/` được đóng gói trong file `.zip`.
