# Weight Tracking — ghi chú cho Claude

App Android (Capacitor, HTML/CSS/JS thuần trong `www/`) của Mondiro, tối ưu Samsung Z Fold 7. Theo skill `m-skill`.

## Quy ước làm việc (người dùng đã đồng ý)
- **Được đẩy thẳng lên `main`** sau khi đã chạy thử (người dùng không muốn bấm merge PR mỗi lần).
  Push lên `main` → GitHub Actions tự build APK và đăng Release `build-N` → app trên máy tự báo cập nhật.
  Nếu người dùng nói "lần này để mình duyệt" thì tạo PR như cũ.
- Mỗi lần giao bản mới: gửi `WeightTracking-preview.html` (từ `node build_preview.js` → `dist/preview.html`) + zip source.
- Trả lời bằng tiếng Việt, đơn giản (người dùng là artist, không biết lập trình).

## Không được làm
- **Không đưa dữ liệu cân nặng/ghi chú thật vào repo** (repo public). `www/seed-data.js` phải rỗng; preview dùng dữ liệu giả.
- **Không xoá/đổi `android/app/mondiro-release.keystore`** — đổi khoá thì máy đã cài không cập nhật đè được.
- Không đổi `appId` `com.mondiro.weighttracking`.

## Kỹ thuật
- Tự cập nhật: `www/app.js` hỏi `https://api.github.com/repos/satthupc00/Weight_Tracking/releases/latest`, tag `build-<versionCode>`;
  `versionCode` = `GITHUB_RUN_NUMBER`. Workflow chỉ giữ release + artifact mới nhất.
- Kiểm tra nhanh: `node --check www/app.js`, `node build_preview.js`, rồi mở `dist/preview.html` bằng Playwright
  (Chromium ở `/opt/pw-browsers/chromium`) ở cỡ 412×915 (màn ngoài) và 840×760 (màn trong).
