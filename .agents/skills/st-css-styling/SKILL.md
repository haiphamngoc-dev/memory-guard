---
name: st-css-styling
description: >-
  St CSS (Shell Toolkit) cho GNOME Shell Extension: sự khác biệt với web CSS,
  thuộc tính hỗ trợ và không hỗ trợ, St widgets (BoxLayout, Label, Icon, Button),
  Clutter alignment, class naming convention, animation bằng Clutter, hot-reload CSS.
  Dùng khi sửa stylesheet.css, viết St widget layout, styling, hoặc khi đề cập
  CSS, style, giao diện, theme, màu sắc trong GNOME Shell extension.
---

# St CSS — Shell Toolkit Styling

GNOME Shell sử dụng **St (Shell Toolkit) CSS**, một tập con giới hạn của CSS chuẩn web. Hiểu rõ sự khác biệt này là then chốt để tránh lỗi styling.

## 1. St CSS vs Web CSS

| Tính năng | St CSS | Web CSS |
|-----------|--------|---------|
| `padding`, `margin` | ✅ Hỗ trợ | ✅ |
| `font-size`, `font-weight`, `color` | ✅ Hỗ trợ | ✅ |
| `background-color` | ✅ Hỗ trợ | ✅ |
| `border`, `border-radius` | ✅ Hỗ trợ | ✅ |
| `icon-size` | ✅ Riêng St | ❌ Không có |
| `spacing` (giữa children) | ✅ Riêng St | ❌ Dùng `gap` |
| `min-width`, `min-height` | ✅ Hỗ trợ | ✅ |
| `max-width`, `max-height` | ✅ Hỗ trợ | ✅ |
| `text-align` | ✅ Hỗ trợ | ✅ |
| `box-shadow` | ⚠️ Hạn chế | ✅ Đầy đủ |
| CSS Custom Properties `var()` | ❌ **KHÔNG** hỗ trợ | ✅ |
| Flexbox (`display: flex`) | ❌ **KHÔNG** hỗ trợ | ✅ |
| Grid (`display: grid`) | ❌ **KHÔNG** hỗ trợ | ✅ |
| CSS Animations `@keyframes` | ❌ **KHÔNG** hỗ trợ | ✅ |
| CSS Transitions | ❌ **KHÔNG** hỗ trợ | ✅ |
| `::before`, `::after` | ❌ **KHÔNG** hỗ trợ | ✅ |
| Media queries | ❌ **KHÔNG** hỗ trợ | ✅ |
| `:nth-child`, `:not()` | ❌ **KHÔNG** hỗ trợ | ✅ |
| `opacity` | ❌ Dùng Clutter | ✅ |

## 2. Quy Ước Đặt Tên CSS Class

- Sử dụng `kebab-case` với **prefix tên extension** để tránh xung đột:
  - ✅ `.my-extension-title`, `.my-extension-icon`, `.my-extension-warning`
  - ❌ `.title`, `.icon`, `.warning` (có thể trùng với Shell theme)

- Sử dụng class có ngữ nghĩa thay vì class chức năng:
  - ✅ `.my-extension-critical` (trạng thái)
  - ❌ `.my-extension-red` (mô tả màu)

## 3. Các St Widget Chính

### St.BoxLayout — Container chính

```javascript
const box = new St.BoxLayout({
  vertical: true,              // true = cột, false = hàng
  x_align: Clutter.ActorAlign.CENTER,
  y_align: Clutter.ActorAlign.CENTER,
  style_class: 'my-extension-content',
});
```

### St.Label — Văn bản

```javascript
const label = new St.Label({
  text: 'Hello World',
  style_class: 'my-extension-label',
  x_align: Clutter.ActorAlign.CENTER,
});
```

### St.Icon — Biểu tượng

```javascript
const icon = new St.Icon({
  icon_name: 'dialog-warning-symbolic',
  icon_size: 48,
  style_class: 'my-extension-icon',
});
```

Tên icon symbolic phổ biến: `dialog-warning-symbolic`, `dialog-information-symbolic`, `dialog-error-symbolic`, `preferences-system-symbolic`, `system-run-symbolic`.

### St.Button — Nút bấm

```javascript
const button = new St.Button({
  label: 'Click Me',
  style_class: 'my-extension-button',
  can_focus: true,
});
button.connect('clicked', () => { /* xử lý */ });
```

### St.Entry — Ô nhập liệu

```javascript
const entry = new St.Entry({
  hint_text: 'Enter value...',
  style_class: 'my-extension-entry',
  can_focus: true,
});
const text = entry.get_text();
```

## 4. Clutter Alignment

St CSS không hỗ trợ Flexbox. Thay vào đó, dùng Clutter alignment:

| Clutter | Tương đương Flexbox |
|---------|-------------------|
| `Clutter.ActorAlign.START` | `flex-start` |
| `Clutter.ActorAlign.CENTER` | `center` |
| `Clutter.ActorAlign.END` | `flex-end` |
| `Clutter.ActorAlign.FILL` | `stretch` |

```javascript
const box = new St.BoxLayout({
  vertical: true,
  x_align: Clutter.ActorAlign.CENTER,
  y_align: Clutter.ActorAlign.START,
  x_expand: true,   // Mở rộng theo chiều ngang
  y_expand: false,   // Không mở rộng theo chiều dọc
});
```

## 5. Ví Dụ Stylesheet

```css
/* Container dialog */
.my-extension-dialog .modal-dialog-content-box {
  padding: 24px 32px;
}

/* Icon cảnh báo */
.my-extension-icon {
  color: #e74c3c;
  margin-bottom: 16px;
}

/* Tiêu đề */
.my-extension-title {
  font-size: 18pt;
  font-weight: bold;
  color: #e74c3c;
  margin-bottom: 12px;
  text-align: center;
}

/* Nội dung */
.my-extension-body {
  font-size: 11pt;
  color: #deddda;
  margin-bottom: 8px;
  text-align: center;
}

/* Trạng thái cảnh báo (thêm/xóa bằng JS) */
.my-extension-warning {
  color: #f9e44c;
}

.my-extension-critical {
  color: #e74c3c;
}
```

### Thêm/Xóa Style Class Bằng JavaScript

```javascript
// Thêm class
widget.add_style_class_name('my-extension-critical');

// Xóa class
widget.remove_style_class_name('my-extension-critical');

// Inline style (tránh nếu có thể)
widget.set_style('color: red; font-size: 14pt;');
```

## 6. Animation Bằng Clutter

St CSS không hỗ trợ `@keyframes` hay `transition`. Dùng Clutter để tạo animation:

```javascript
// Fade in
widget.opacity = 0;
widget.ease({
  opacity: 255,
  duration: 300,
  mode: Clutter.AnimationMode.EASE_OUT_QUAD,
});

// Scale
widget.ease({
  scale_x: 1.2,
  scale_y: 1.2,
  duration: 200,
  mode: Clutter.AnimationMode.EASE_IN_OUT_QUAD,
  onComplete: () => { /* sau khi hoàn tất */ },
});
```

## 7. Hot-Reload CSS (Debugging)

Reload stylesheet mà không cần restart GNOME Shell bằng Looking Glass (`Alt+F2 → lg`):

```javascript
St.ThemeContext.get_for_stage(global.stage)
  .get_theme()
  .load_stylesheet(
    Gio.File.new_for_path('/path/to/stylesheet.css')
  );
```

## 8. Hỗ Trợ Light/Dark Theme

GNOME Shell tự động chuyển đổi giữa light và dark theme. Để hỗ trợ cả hai:

- Tránh hardcode màu nền cố định — nên dùng màu chữ rõ ràng trên cả nền sáng lẫn tối
- Tham khảo màu từ Shell theme: `#deddda` (text sáng), `#3d3846` (text tối)
- Kiểm tra giao diện trên cả hai theme trước khi commit

## 9. Checklist

- [ ] Không sử dụng thuộc tính CSS không được St hỗ trợ (`var()`, flexbox, grid, `@keyframes`).
- [ ] Tất cả CSS class có prefix tên extension (tránh xung đột).
- [ ] Animation dùng Clutter `ease()` thay cho CSS transitions/keyframes.
- [ ] Màu sắc dễ đọc trên cả GNOME Shell light và dark theme.
- [ ] Không dùng `opacity` trong CSS — sử dụng `widget.opacity` (Clutter).
