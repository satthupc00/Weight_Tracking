# Weight Tracking (Created by Mondiro)

Ứng dụng theo dõi cân nặng cho Android, tối ưu cho Samsung Z Fold 7. Xây bằng
Capacitor (web app đóng gói native) — cùng cách làm với app "Money Tracking".

## Tính năng
- 2 tab: **Biểu đồ** và **Cài đặt**, chuyển qua lại bằng 2 nút tròn ở thanh dưới.
- Biểu đồ cân nặng: zoom bằng 2 ngón (pinch), pan bằng 1 ngón, không bị vỡ nét/số khi zoom.
  - Đường chấm chấm ngang màu đỏ = mục tiêu cân nặng (nhập ở Cài đặt).
  - Đường chấm chấm màu xanh = dự đoán xu hướng, tính bằng hồi quy tuyến tính trên 7 lần đo gần nhất.
  - Số đo vào **thứ Hai** hiển thị chấm màu đỏ.
  - Chạm vào biểu đồ → hiện đường kẻ đứng nét đứt + bong bóng thông tin (cân nặng, ngày, ghi chú) tại điểm gần nhất.
- Nút **+** đỏ to ở giữa dưới màn hình để nhập cân nặng mới (ngày, ghi chú, bánh xe chọn số kg.g giống ảnh mẫu).
- Cài đặt: nhập mục tiêu cân nặng, chiều cao (tuỳ chọn, để tính BMI), xuất/nhập file CSV.
- Dữ liệu lưu cục bộ trên máy (localStorage), còn nguyên khi tắt/mở lại app.
- File CSV xuất/nhập cùng định dạng với file mẫu bạn đã gửi: `"YYYY-MM-DD"	"weight"	"note"` (tab-separated).
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
Icon hiện tại (đường xu hướng cân nặng màu xanh ngọc + 1 chấm đỏ, nền xanh navy) đã được tạo sẵn và
áp vào project Android rồi — không cần làm gì thêm để build. Nếu sau này muốn đổi icon khác:
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
