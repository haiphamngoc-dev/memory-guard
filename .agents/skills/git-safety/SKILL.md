---
name: git-safety
description: >-
  Quy tắc an toàn bắt buộc cho các nhánh được bảo vệ: không bao giờ commit,
  push, hay force-push trực tiếp vào main hoặc nhánh release; không viết lại
  lịch sử phá hủy mà không có sự đồng ý rõ ràng từ người dùng. Áp dụng trước
  bất kỳ thao tác git nào liên quan đến nhánh được bảo vệ, trước force-push,
  reset --hard, viết lại lịch sử, hoặc xóa nhánh.
---

# Quy Tắc An Toàn Git

## QUAN TRỌNG: Quy Tắc Nhánh Được Bảo Vệ

**AI agent KHÔNG BAO GIỜ được commit hoặc push vào nhánh được bảo vệ trong bất kỳ trường hợp nào.**

### Các Nhánh Được Bảo Vệ

- `main` — Nhánh production chính
- `release/*` — Các nhánh release (VD: `release/v2.0.0`)

Đây là quy tắc không thể thương lượng, áp dụng cho mọi tình huống:

### Các Hành Vi Bị Cấm

- **Commit trực tiếp** — Không chạy `git commit` khi đang ở nhánh được bảo vệ
- **Push trực tiếp** — Không chạy `git push origin <nhánh-bảo-vệ>` hoặc `git push` khi đang ở nhánh được bảo vệ
- **Force push** — Không chạy `git push --force` hoặc `git push -f` nhắm vào nhánh được bảo vệ
- **Merge vào nhánh bảo vệ trên local** — Không chạy `git merge <nhánh>` khi đang ở nhánh được bảo vệ
- **Rebase nhánh bảo vệ** — Không chạy `git rebase` khi đang ở nhánh được bảo vệ
- **Reset nhánh bảo vệ** — Không chạy `git reset` khi đang ở nhánh được bảo vệ

### Quy Trình Bắt Buộc

1. **Luôn tạo feature branch** trước khi thực hiện bất kỳ thay đổi nào
2. **Kiểm tra nhánh hiện tại** trước mọi thao tác git bằng `git branch --show-current`
3. **Tạo Pull Request / Merge Request** cho mọi thay đổi — để quy trình review xử lý việc merge

### Checklist Trước Khi Push

Trước khi thực hiện bất kỳ lệnh push nào, AI agent phải:

1. Xác nhận nhánh hiện tại KHÔNG phải nhánh được bảo vệ (`main`, `release/*`)
2. Kiểm tra remote và nhánh đích

### Xử Lý Sự Cố

Nếu vô tình đang ở nhánh được bảo vệ với thay đổi chưa commit:

1. Stash thay đổi: `git stash`
2. Tạo nhánh mới: `git checkout -b <tên-nhánh-phù-hợp>`
3. Áp dụng thay đổi: `git stash pop`
4. Tiếp tục làm việc trên nhánh mới

## Lý Do

- Các nhánh được bảo vệ đại diện cho code sẵn sàng production hoặc release
- Mọi thay đổi phải qua code review thông qua Pull Request / Merge Request
- Push trực tiếp bỏ qua kiểm tra CI/CD và review của team
- Sai sót trên nhánh được bảo vệ có thể ảnh hưởng đến toàn bộ team và pipeline triển khai
