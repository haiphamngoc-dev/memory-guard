---
name: code-quality
description: >-
  Tiêu chuẩn chất lượng code GJS cho GNOME Shell Extension: ESM strict,
  quy ước đặt tên (PascalCase class, _camelCase private, kebab-case GSettings/CSS),
  JSDoc tiếng Anh, error handling, clean code, resource management.
  Dùng khi viết hoặc refactor code JavaScript trong extension, khi đề cập
  đến code quality, naming, style, clean code, best practices.
---

# Tiêu Chuẩn Chất Lượng Code GJS

## 1. Quy Tắc Cốt Lõi

- **ESM Only**: Luôn dùng `import` / `export`. Không sử dụng `imports.*` (legacy GJS).
- **Strict mode**: Luôn dùng `const` cho giá trị không thay đổi, `let` cho biến. Không bao giờ dùng `var`.
- **Comment & JSDoc**: Bắt buộc viết bằng **tiếng Anh (English)**.
- Không dùng `console.error()` trong production — dùng `logError(error, prefix)` để có stack trace.
- Không để lại `console.log()` debug trong code production.

---

## 2. Quy Ước Đặt Tên

| Phần tử | Quy ước | Ví dụ |
|---------|--------|-------|
| JS Class | `PascalCase` | `MemoryWarningDialog`, `MyIndicator` |
| JS Private method | `_camelCase` | `_checkMemory()`, `_readFile()` |
| JS Public method | `camelCase` | `enable()`, `disable()`, `updateDisplay()` |
| JS Local variable | `camelCase` | `ramPercent`, `combinedUsage` |
| JS Constant (module-level) | `UPPER_SNAKE_CASE` | `MAX_RETRY`, `DEFAULT_INTERVAL` |
| GSettings key | `kebab-case` | `memory-threshold`, `check-interval` |
| CSS class | `kebab-case` + prefix | `.my-ext-title`, `.my-ext-warning` |
| GSettings schema ID | `dot.separated` | `org.gnome.shell.extensions.my-ext` |
| Extension UUID | `name@domain` | `my-ext@author.domain` |

---

## 3. JSDoc

Viết JSDoc bằng tiếng Anh cho các method quan trọng:

```javascript
/**
 * Read and parse /proc/meminfo asynchronously.
 *
 * @returns {Promise<{memTotal: number, memAvailable: number,
 *           swapTotal: number, swapFree: number} | null>}
 *          Parsed memory info or null on failure.
 */
async _readMeminfo() {
  // ...
}

/**
 * Show a modal warning dialog with memory usage details.
 *
 * @param {number} ramPercent      - Current RAM usage (0-100)
 * @param {number} swapPercent     - Current Swap usage (0-100)
 * @param {number} combinedPercent - Combined usage (0-100)
 * @param {number} threshold       - Configured warning threshold
 */
_showWarningDialog(ramPercent, swapPercent, combinedPercent, threshold) {
  // ...
}
```

### Khi Nào Cần JSDoc

- ✅ Các method chính của Extension class (`enable`, `disable`, các method core)
- ✅ Constructor của GObject class (ghi rõ params)
- ✅ Các hàm utility phức tạp
- ❌ Getter/setter đơn giản, one-liner methods rõ ràng

---

## 4. Error Handling

### Wrap I/O Operations

Mọi thao tác đọc file, network, hoặc system call phải được bọc trong `try/catch`:

```javascript
async _readData() {
  try {
    const file = Gio.File.new_for_path('/proc/meminfo');
    const [contents] = await file.load_contents_async(null);
    return new TextDecoder().decode(contents);
  } catch (e) {
    logError(e, 'MyExtension: failed to read data');
    return null;
  }
}
```

### Guard Clauses

Sử dụng early return thay vì nesting sâu:

```javascript
// ✅ Tốt — guard clause
_check() {
  if (this._checking) return;
  if (!this._settings) return;

  const value = this._settings.get_int('threshold');
  // ... logic chính
}

// ❌ Không tốt — nesting sâu
_check() {
  if (!this._checking) {
    if (this._settings) {
      const value = this._settings.get_int('threshold');
      // ... logic chính
    }
  }
}
```

### Không Dùng unwrap() Pattern

Luôn kiểm tra giá trị null/undefined trước khi sử dụng:

```javascript
// ✅ Tốt — optional chaining
this._indicator?.updateDisplay(data);
this._dialog?.close();

// ✅ Tốt — nullish coalescing
const interval = this._settings?.get_int('interval') ?? 5;
```

---

## 5. Clean Code

### Tránh Magic Numbers

```javascript
// ❌ Không tốt
if (combinedPercent >= 70) {
  icon.add_style_class_name('warning');
}

// ✅ Tốt
const WARNING_THRESHOLD_PERCENT = 70;
if (combinedPercent >= WARNING_THRESHOLD_PERCENT) {
  icon.add_style_class_name('warning');
}
```

### Giữ Methods Ngắn Gọn

Mỗi method nên có một nhiệm vụ duy nhất. Nếu method quá dài (>30 dòng logic), tách thành các helper methods nhỏ hơn.

### Tránh Code Trùng Lặp (DRY)

Nếu cùng một đoạn logic xuất hiện >= 2 lần, tách ra thành method riêng.

---

## 6. Resource Management

### Quy Tắc Vàng: Mọi Tài Nguyên Tạo Trong enable() Phải Được Giải Phóng Trong disable()

```javascript
enable() {
  // Tạo tài nguyên
  this._settings = this.getSettings();
  this._timerId = GLib.timeout_add_seconds(...);
  this._signalId = this._settings.connect(...);
  this._indicator = new MyIndicator(this);
  Main.panel.addToStatusArea('my-ext', this._indicator);
}

disable() {
  // Giải phóng theo thứ tự ngược lại
  if (this._timerId) {
    GLib.source_remove(this._timerId);
    this._timerId = 0;
  }
  if (this._signalId) {
    this._settings.disconnect(this._signalId);
    this._signalId = 0;
  }
  this._indicator?.destroy();
  this._indicator = null;
  this._settings = null;
}
```

### Source ID Convention

Khởi tạo source IDs bằng `0` (falsy) để dễ kiểm tra:

```javascript
this._timerId = 0;      // Không có timer
this._signalId = 0;     // Không có signal
```

---

## 7. Checklist Trước Khi Commit

- [ ] Không còn `console.log()` debug trong code production.
- [ ] Không dùng `var` — chỉ `const` hoặc `let`.
- [ ] Mọi I/O operation đều có `try/catch` và `logError()`.
- [ ] Tên biến, method, class theo đúng quy ước đặt tên.
- [ ] JSDoc viết bằng tiếng Anh cho các method chính.
- [ ] Không có magic numbers — sử dụng hằng số có tên.
- [ ] `disable()` giải phóng mọi tài nguyên đã tạo trong `enable()`.
- [ ] Source IDs khởi tạo bằng `0` và được kiểm tra trước khi remove.
