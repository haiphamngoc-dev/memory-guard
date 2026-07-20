---
name: commits
description: >-
  Tạo commit message theo đúng định dạng Conventional Commits cho GNOME Shell
  Extension. Áp dụng khi tạo commit, viết commit message, hoặc khi người dùng
  yêu cầu commit các thay đổi.
---

# Hướng dẫn Commit Message

**BẮT BUỘC: Commit message phải luôn viết bằng tiếng Anh.** Bao gồm subject, body, và footer.

Tuân thủ định dạng **Conventional Commits**:

```text
<loại>(<phạm-vi>): <mô-tả>

<nội-dung-chi-tiết>

<footer>
```

## Các Loại Commit

- `feat` — Tính năng mới
- `fix` — Sửa lỗi
- `refactor` — Tái cấu trúc code
- `test` — Thêm hoặc cập nhật test
- `docs` — Thay đổi tài liệu
- `chore` — Công việc bảo trì (dependency, cấu hình build)
- `style` — Thay đổi style code (formatting, CSS)
- `perf` — Cải thiện hiệu năng
- `ci` — Thay đổi CI/CD

## Các Phạm Vi (Scopes) Cho GNOME Extension

- `extension` — Thay đổi logic trong `extension.js` (core runtime)
- `prefs` — Thay đổi UI preferences (`prefs.js`)
- `schema` — Thay đổi GSettings schema (`.gschema.xml`)
- `css` — Thay đổi `stylesheet.css`
- `meta` — Thay đổi `metadata.json`
- `i18n` — Thay đổi bản dịch (`.po`, `.pot`, `.mo`)
- `docs` — Thay đổi tài liệu (`README.md`, `DEVELOPMENT.md`)

## Ví dụ

```bash
feat(extension): add notification sound when dialog appears

Plays a system alert sound via Clutter when the memory warning
dialog is shown to the user.

refs #42

---

fix(extension): handle zero swap total to prevent division by zero

When the system has no swap partition, SwapTotal is 0 which caused
a NaN result in combined usage calculation.

Fixes #15

---

feat(prefs): add combo row for display format selection

chore(schema): add display-format key to GSettings schema

style(css): update dialog colors for better dark theme contrast

docs: update DEVELOPMENT.md with testing section

feat(i18n): add Vietnamese translations for dialog strings
```

## Thực Hành Tốt

### Commit Tốt

- Dòng mô tả rõ ràng, mang tính mô tả (giới hạn 50-72 ký tự)
- Thay đổi nguyên tử (mỗi commit chỉ chứa một thay đổi logic)
- Tham chiếu issue/ticket trong phần body
- Giải thích **tại sao**, không chỉ **cái gì**
- **Giữ ngắn gọn** — Không liệt kê từng file thay đổi trong body

### Commit Không Tốt

```bash
# Quá mơ hồ
fix stuff
WIP
update

# Quá rộng
add feature, fix bugs, refactor code, update tests
```

## Tham Chiếu Issue

- **GitHub**: `closes #XXX` hoặc `fixes #XXX` hoặc `refs #XXX`
- **GitLab**: `closes #XXX` hoặc `resolves #XXX`
- Dùng `#` để tự động liên kết trong commit message.
