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

## Sao lưu cloud (GitHub)
Mỗi lần thêm/sửa/xoá số cân, khoảng 5 giây sau app tự đẩy file `weight-data.csv` (cùng định dạng
"Xuất file CSV") lên 1 repo GitHub **private** của bạn. Mỗi lần sao lưu là 1 commit, nên xem lại được
mọi phiên bản cũ. Mất mạng thì app nhớ lại và thử tiếp khi mở app lần sau.
App **không tự kéo về** — trên máy mới/vừa cài lại, bấm **Cài đặt → Khôi phục từ bản sao lưu**.
Máy chưa từng sao lưu sẽ không tự ghi đè bản đã có trên cloud.

Cài 1 lần:
1. Tạo repo **Private**, vd `weight_tracking_data` (tick Add a README file).
2. Tạo fine-grained token: chỉ chọn repo đó, **Contents: Read and write**.
3. Trong app: Cài đặt → Sao lưu cloud → nhập `satthupc00/weight_tracking_data` và token.
Token chỉ lưu trên máy, không nằm trong APK hay trong code.
