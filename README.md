# Weight Tracking (Created by Mondiro)

Ứng dụng theo dõi cân nặng cho Android, tối ưu cho Samsung Z Fold 7. Xây bằng
Capacitor (web app đóng gói native) — cùng cách làm với app "Money Tracking".

## Tính năng
- **Thước cân** trên đầu (giống băng số cân cơ): kim đỏ + nhãn đỏ là cân nặng mới nhất, tam giác xanh là mục tiêu,
  tam giác đỏ là cân nặng hiện tại. Mở app thì băng trượt từ lần cân trước tới hôm nay. Bên dưới 1 dòng nhỏ:
  mục tiêu, BMI (nếu nhập chiều cao), tăng/giảm so với tuần trước.
- Nút khoảng thời gian **Tuần / Tháng / 3 tháng / Năm / Tất cả** — biểu đồ trượt + zoom mượt sang khung mới, gạch dưới tab trượt theo;
  vẫn pinch zoom, kéo, chạm đúp rồi kéo để zoom.
- Thước cân **kéo được**: giữ và kéo trái/phải để dò số, kim đỏ đung đưa theo tốc độ kéo, dừng thì nảy nhẹ rồi đứng;
  buông tay thì thước tự quay về số cân mới nhất.
- Mốc có ghi chú có dấu **!** vàng cạnh số; chạm 1 mốc thì số của mốc đó nhún 1 cái rồi to lên, bảng info chỉ ghi
  ngày + nút sửa (ghi chú màu vàng).
- Kéo biểu đồ rồi buông tay → biểu đồ trôi tiếp theo quán tính rồi dừng dần.
- **Mốc năm**: mỗi năm một dải nền sáng/tối xen kẽ + vạch đầu năm kèm nhãn "2025", "2026"…; năm đang xem ghim ở góc trái.
- Nhập cân bằng nút **+** → bảng trượt lên báo đã giảm/tăng bao nhiêu kg (hoặc không đổi) so với lần cân trước;
  chạm bất kỳ đâu để bảng trượt xuống.
- Mọi nút có hiệu ứng lún/nảy khi bấm; bấm **+** thì nút ✓ và ↩ tách ra 2 bên, lưu/huỷ thì 2 nút gộp lại.
- Bánh xe nhập số xoay kiểu trống 3D, vuốt mạnh thì trôi theo quán tính rồi trượt êm vào đúng số gần nhất.
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
Repo này là **public**. Mỗi lần có thay đổi được merge vào `main`, GitHub Actions tự build APK và đăng lên
**Releases của chính repo này** (tag `build-<số>`, file `WeightTracking.apk`) — không cần token hay repo phụ.
Mỗi khi mở app, app hỏi Releases xem có bản mới không → hiện bảng "Có bản cập nhật mới" → bấm **Cập nhật** →
app tự tải APK và mở màn hình cài đặt của Android → bấm **Cài đặt**. Dữ liệu giữ nguyên.
Có thể kiểm tra tay ở **Cài đặt → Cập nhật → Kiểm tra bản mới**.
Repo chỉ giữ **bản phát hành mới nhất**: mỗi lần build xong, GitHub Actions tự xoá các bản phát hành và file APK cũ.

### Bỏ repo phát hành cũ `weight_tracking_release`
Các bản app ≤ 1.0.27 vẫn hỏi repo cũ. Vì vậy bản đầu tiên sau thay đổi này được đăng vào **cả 2 nơi**.
1. Mở app trên **từng máy** và cập nhật lên bản mới (≥ 1.0.28). Từ bản này app hỏi repo `Weight_Tracking`.
2. Khi mọi máy đã cập nhật: xoá repo `weight_tracking_release` (Settings → Danger Zone → Delete this repository),
   xoá secret `RELEASES_TOKEN` (Settings → Secrets and variables → Actions), xoá luôn token GitHub đã tạo cho nó.
   Không cần sửa code: bước đăng vào repo cũ tự bỏ qua khi không còn secret.

### Lưu ý quan trọng
- **Đừng xoá/đổi file `android/app/mondiro-release.keystore`** — mất nó thì các máy không cập nhật đè được nữa.
- Lần đầu bấm Cập nhật, Android sẽ hỏi cho phép app "Cài ứng dụng không rõ nguồn gốc" → bật lên 1 lần.
- Nội dung ghi chú bản cập nhật = nội dung commit message.

## Đồng bộ Firebase (nhiều máy dùng chung dữ liệu)
Dữ liệu vẫn nằm trên máy là chính; khi có mạng và đã đăng nhập, app tự đồng bộ lên Firebase (Firestore) lúc mở app,
lúc quay lại app và vài giây sau mỗi lần thêm/sửa/xoá. Cùng 1 ngày mà 2 máy sửa khác nhau → bản sửa sau cùng thắng.
Icon đám mây cạnh ngày trên thanh tiêu đề: xám = chưa bật, xanh = đã đồng bộ, vàng nhấp nháy = đang đồng bộ, đỏ = lỗi.

### Cài 1 lần (Firebase console, làm được trên điện thoại)
1. https://console.firebase.google.com → **Create a project** → tên `Weight Tracking` → tắt Google Analytics → Create.
2. **Build → Authentication → Get started → Email/Password** → bật **Enable** (không cần "Email link") → Save.
3. **Build → Firestore Database → Create database** → vị trí `asia-southeast1 (Singapore)` → **Start in production mode** → Create.
   Mở tab **Rules**, thay toàn bộ bằng đoạn dưới rồi bấm **Publish**:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{uid}/{document=**} {
         allow read, write: if request.auth != null && request.auth.uid == uid;
       }
     }
   }
   ```
4. Bánh răng **Project settings → General → Your apps → biểu tượng `</>` (Web)** → đặt tên → Register app.
   Copy 2 giá trị **apiKey** và **projectId** → điền vào `www/firebase-config.js` (hoặc gửi cho Claude điền giúp).
5. Mở app → Cài đặt → Đồng bộ Firebase → **Tạo tài khoản** (máy đầu tiên) / **Đăng nhập** (các máy sau).
6. (Nên làm) Sau khi đã tạo tài khoản: Authentication → Settings → User actions → bỏ tick **Enable create (sign-up)**
   để người khác không tạo được tài khoản trong dự án của bạn.

apiKey/projectId không phải mật khẩu — để công khai được; dữ liệu được bảo vệ bởi Rules ở bước 3 (mỗi tài khoản chỉ đọc/ghi phần của mình).
Gói miễn phí (Spark) của Firebase dư dùng cho app này.
