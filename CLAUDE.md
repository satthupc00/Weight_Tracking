# Weight Tracking — ghi chú cho Claude

App Android (Capacitor, HTML/CSS/JS thuần trong `www/`) của Mondiro, tối ưu Samsung Z Fold 7. Theo skill `m-skill`.

## Quy ước làm việc (người dùng đã đồng ý)
- **Được đẩy thẳng lên `main`** sau khi đã chạy thử (người dùng không muốn bấm merge PR mỗi lần).
  Cách phát hành khi Claude tự đẩy (đã kiểm chứng):
  1. Commit có `[skip ci]` trong tiêu đề rồi `git push origin HEAD:main`
     (build do push của Claude kích hoạt bị GitHub từ chối tạo release: "HTTP 403 Resource not accessible by integration").
  2. Chạy workflow bằng tay: GitHub MCP `actions_run_trigger` → `run_workflow`, `workflow_id: build.yml`, `ref: main`
     → build APK + đăng Release `build-N` → app trên máy tự báo cập nhật. Đợi ~4 phút rồi kiểm tra release mới.
  Khi người dùng tự merge PR thì push đó tự build + phát hành như bình thường.
  Nếu người dùng nói "lần này để mình duyệt" thì tạo PR như cũ.
- Mỗi lần giao bản mới: gửi `WeightTracking-preview.html` (từ `node build_preview.js` → `dist/preview.html`) + zip source.
- Trả lời bằng tiếng Việt, đơn giản (người dùng là artist, không biết lập trình).

## Không được làm
- **Không đưa dữ liệu cân nặng/ghi chú thật vào repo** (repo public). `www/seed-data.js` phải rỗng; preview dùng dữ liệu giả.
- **Không xoá/đổi `android/app/mondiro-release.keystore`** — đổi khoá thì máy đã cài không cập nhật đè được.
- Không đổi `appId` `com.mondiro.weight` (đã đăng ký với Google Android Developer Console từ 23/10/2026).

## Kỹ thuật
- Đồng bộ Firebase: `www/sync.js` (REST: Auth email/mật khẩu + Firestore `users/{uid}/entries/{date}`), cấu hình ở
  `www/firebase-config.js` (apiKey + projectId công khai được; bảo vệ bằng Rules trong README). Gộp theo `updatedAt`,
  ngày bị xoá lưu ở localStorage `wt_deleted_v1`. Kiểm thử bằng Firebase giả lập (route các host *.googleapis.com trong Playwright).
- Tự cập nhật: `www/app.js` hỏi `https://api.github.com/repos/satthupc00/Weight_Tracking/releases/latest`, tag `build-<versionCode>`;
  `versionCode` = `GITHUB_RUN_NUMBER`. Workflow chỉ giữ release + artifact mới nhất.
- Kiểm tra nhanh: `node --check www/app.js`, `node build_preview.js`, rồi mở `dist/preview.html` bằng Playwright
  (Chromium ở `/opt/pw-browsers/chromium`) ở cỡ 412×915 (màn ngoài) và 840×760 (màn trong).
