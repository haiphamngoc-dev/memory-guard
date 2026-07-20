---
name: branches
description: >-
  Tạo và đặt tên nhánh git theo đúng quy ước dự án. Áp dụng khi tạo nhánh,
  checkout nhánh mới, hoặc khi đề cập đến quy ước đặt tên nhánh.
---

# Quy Ước Đặt Tên Nhánh

Sử dụng lowercase kebab-case với tiền tố loại nhánh. Mã issue/ticket là **tùy chọn** (optional).

```bash
# Mẫu: <loại>/<mã-issue>/<mô-tả-ngắn>   (có mã issue)
# Mẫu: <loại>/<mô-tả-ngắn>              (không có mã issue)

# Ví dụ có mã issue (GitHub/GitLab)
feature/42/add-notification-sound
bugfix/15/fix-zero-swap-division
docs/33/update-development-guide

# Ví dụ không có mã issue
feature/add-panel-indicator
bugfix/fix-dialog-not-closing
docs/update-readme
chore/update-shell-version-48

# Nhánh đặc biệt
release/v2.0.0
```

## Các Loại Nhánh

- `feature/` — Tính năng mới và refactoring
- `bugfix/` — Sửa lỗi
- `docs/` — Thay đổi tài liệu
- `test/` — Thay đổi liên quan đến test
- `chore/` — Cập nhật cấu hình, metadata, dependencies
- `release/` — Nhánh release

## Tham Chiếu Issue

- **GitHub / GitLab**: Sử dụng mã số (ID) của issue (VD: `42`)
- Chỉ dùng `#` trong commit message, **không dùng trong tên nhánh**.
