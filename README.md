# Weight Tracking (Created by Mondiro)

Ứng dụng theo dõi cân nặng cho Android, tối ưu cho Samsung Z Fold 7. Xây bằng
Capacitor (web app đóng gói native) — cùng cách làm với app "Money Tracking".

## Tính năng
- **Thước cân** trên đầu (giống băng số cân cơ): kim đỏ + nhãn đỏ là cân nặng mới nhất, tam giác xanh là mục tiêu,
  tam giác đỏ là cân nặng hiện tại. Mở app thì băng trượt từ lần cân trước tới hôm nay. Bên dưới 1 dòng nhỏ:
  mục tiêu, BMI (nếu nhập chiều cao), tăng/giảm so với tuần trước.
- Nút khoảng thời gian **Tuần / Tháng / 3 tháng / Năm / Tất cả**; vẫn pinch zoom, kéo, chạm đúp rồi kéo để zoom.
- Biểu đồ: đường xanh có nền mờ, chấm **thứ Hai màu đỏ**, đường chấm xanh = mục tiêu, đường chấm xám = dự đoán xu hướng
  (hồi quy 7 lần cân gần nhất). Số chỉ ẩn khi thật sự đè lên số khác; zoom xa chỉ hiện số mới nhất, cao nhất, thấp nhất.
- Chạm 1 điểm → bảng info (cân nặng, ngày, BMI, ghi chú) + nút **bút chì** để sửa lần cân đó.
- **Nhật ký**: danh sách các lần cân kèm ghi chú và mức tăng/giảm; chạm 1 dòng để sửa. Bấm tiêu đề "Nhật ký" để
  thu/mở (có hiệu ứng); màn hình ngoài mặc định thu gọn, màn hình trong là cột bên phải.
- Nút **+** đỏ to ở giữa để nhập cân nặng (bánh xe kg,g + ngày + ghi chú) — cùng bảng nhập với nút sửa.
- Cài đặt: mục tiêu, chiều cao, xuất/nhập CSV, kiểm tra bản mới, xoá dữ liệu.
- Tự cập nhật qua GitHub Releases (xem mục bên dưới). Font Barlow Condensed + Be Vietnam Pro đóng gói sẵn, chạy offline.
- Chữ "Created by Mondiro" ở góc dưới màn hình.

## Cấu trúc project
```
weight-tracking/
├── www/                 <- mã nguồn web (index.html, styles.css, app.js) — sửa ở đây
├── android/              <- project Android native do Capacitor tạo (mở bằng Android Studio)
├── dist/preview.html     <- bản xem trước độc lập, đã nạp sẵn dữ liệu CSV thật của bạn để xem thử
├── icon-assets/          <- file .svg gốc của icon app (để sửa lại nếu muốn đổi icon)
├── resources/            <- icon.png/icon-foreground.png/icon-background.png dùng để tạo icon Android
├── capacitor.config.ts
└── package.json
```

## Build APK trên máy Windows của bạn (giống quy trình app Money Tracking)
1. Cài Node.js + JDK (bạn đã có sẵn) và Android Studio (để có Android SDK + emulator/thiết bị test).
2. Giải nén file zip này ra một thư mục.
3. Mở terminal tại thư mục đó, chạy:
   ```
   npm install
   npx cap sync android
   ```
4. Cách A — dùng Android Studio: mở thư mục `android/` bằng Android Studio, đợi Gradle sync xong, bấm Run để cài thẳng lên điện thoại/emulator, hoặc Build > Build Bundle(s)/APK(s) > Build APK(s) để xuất file `.apk`.

   Cách B — dòng lệnh: `cd android && gradlew.bat assembleDebug`, file APK sẽ nằm ở
   `android/app/build/outputs/apk/debug/app-debug.apk`.
5. Copy file `.apk` sang điện thoại Z Fold 7 (qua cáp, Google Drive, Zalo...) và cài đặt (cần bật "Cài đặt từ nguồn không xác định").

## Sửa giao diện / logic
Toàn bộ giao diện và logic nằm trong 3 file: `www/index.html`, `www/styles.css`, `www/app.js` —
không dùng React/framework, chỉ HTML/CSS/JS thuần nên dễ đọc và sửa. Sau khi sửa, luôn chạy lại
`npx cap sync android` để đồng bộ vào project Android trước khi build lại.

## Đổi icon app
Icon hiện tại (mặt đồng hồ cân cơ màu ngà, kim đỏ dày, vạch xanh = mục tiêu, nền xanh navy) đã được tạo sẵn và
áp vào project Android rồi (kể cả màn chờ lúc mở app, nền navy) — không cần làm gì thêm để build. Nếu sau này muốn đổi icon khác:
1. Sửa hoặc thay 3 file trong `icon-assets/` (`icon-full.svg` = icon đầy đủ có nền, `icon-foreground.svg`
   = chỉ hình vẽ (nền trong suốt, để trong vùng an toàn ở giữa), `icon-background.svg` = chỉ nền), hoặc
   thay thẳng bằng ảnh thiết kế riêng của bạn.
2. Xuất ra PNG 1024×1024 (nếu sửa từ .svg, có thể dùng https://svgtopng.com hoặc bất kỳ công cụ nào),
   đặt đè vào `resources/icon.png`, `resources/icon-foreground.png`, `resources/icon-background.png`.
3. Chạy:
   ```
   npx capacitor-assets generate --android
   npx cap sync android
   ```
   rồi build lại APK như bình thường.

## Ghi chú
- Mục tiêu cân nặng và chiều cao đang để trống mặc định — vào tab Cài đặt để nhập cho đúng với bạn.
- Xuất file sẽ dùng hộp thoại chia sẻ của Android (Share sheet) nếu cài như native app; khi mở trong trình duyệt thường (như file preview.html) sẽ tải file CSV xuống máy.

## Tự cập nhật trên các máy đã cài
Mỗi lần có thay đổi được push lên nhánh `main`, GitHub Actions tự build APK mới và đăng lên repo
**public** `satthupc00/weight_tracking_release` (chỉ chứa file APK, source + dữ liệu vẫn private).
Mỗi khi mở app, app hỏi repo đó xem có bản mới không → hiện bảng "Có bản cập nhật mới" → bấm
**Cập nhật** → app tự tải APK và mở màn hình cài đặt của Android → bấm **Cài đặt**. Dữ liệu giữ nguyên.
Có thể kiểm tra tay ở **Cài đặt → Cập nhật → Kiểm tra bản mới** (hiện cả số phiên bản đang dùng).

### Cài đặt 1 lần (làm trên web GitHub)
1. Tạo repo mới: https://github.com/new → tên `weight_tracking_release` → chọn **Public** →
   tick **Add a README file** → Create repository.
2. Tạo token: https://github.com/settings/personal-access-tokens/new → Token name `weight-releases`,
   Expiration chọn dài nhất / No expiration → Repository access: **Only select repositories** →
   chọn `weight_tracking_release` → Permissions → Repository permissions → **Contents: Read and write**
   → Generate token → copy chuỗi token.
3. Vào repo `Weight_Tracking` → Settings → Secrets and variables → Actions → **New repository secret**
   → Name: `RELEASES_TOKEN`, Secret: dán token → Add secret.

Chưa có secret này thì app vẫn build bình thường, chỉ là không đăng bản cập nhật.

### Lưu ý quan trọng
- **Lần chuyển đổi đầu tiên:** các bản APK cũ được ký bằng khoá ngẫu nhiên, nên lần đầu phải
  **xuất CSV → gỡ app cũ → cài bản mới → nhập lại CSV**. Từ bản này trở đi mọi bản đều dùng chung
  khoá `android/app/mondiro-release.keystore` nên cập nhật đè được, không mất dữ liệu.
- **Đừng xoá/đổi file `mondiro-release.keystore`** — mất nó thì các máy không cập nhật đè được nữa.
- Lần đầu bấm Cập nhật, Android sẽ hỏi cho phép app "Cài ứng dụng không rõ nguồn gốc" → bật lên 1 lần.
- Nội dung ghi chú bản cập nhật = nội dung commit message.
