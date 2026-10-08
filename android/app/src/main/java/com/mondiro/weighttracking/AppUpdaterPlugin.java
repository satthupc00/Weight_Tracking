package com.mondiro.weighttracking;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Plugin tự cập nhật: cho JS biết số build hiện tại (versionCode),
 * tải file APK mới về bộ nhớ đệm rồi mở trình cài đặt của Android.
 */
@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    @PluginMethod
    public void getVersion(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            long code = Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode;
            JSObject ret = new JSObject();
            ret.put("versionCode", code);
            ret.put("versionName", info.versionName);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Không đọc được phiên bản app: " + e.getMessage());
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Thiếu đường dẫn APK");
            return;
        }
        new Thread(() -> {
            try {
                File dir = new File(getContext().getCacheDir(), "updates");
                dir.mkdirs();
                File apk = new File(dir, "update.apk");
                if (apk.exists()) apk.delete();

                HttpURLConnection conn = openFollowingRedirects(url);
                long total = conn.getContentLengthLong();
                try (InputStream in = conn.getInputStream(); OutputStream out = new FileOutputStream(apk)) {
                    byte[] buf = new byte[64 * 1024];
                    long done = 0;
                    int lastPercent = -1;
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        done += n;
                        if (total > 0) {
                            int percent = (int) (done * 100 / total);
                            if (percent != lastPercent) {
                                lastPercent = percent;
                                JSObject p = new JSObject();
                                p.put("percent", percent);
                                notifyListeners("downloadProgress", p);
                            }
                        }
                    }
                } finally {
                    conn.disconnect();
                }

                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                Intent intent = new Intent(Intent.ACTION_VIEW);
                intent.setDataAndType(uri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(intent);
                call.resolve();
            } catch (Exception e) {
                call.reject("Tải bản cập nhật lỗi: " + e.getMessage());
            }
        }).start();
    }

    // GitHub chuyển hướng link tải sang máy chủ khác — tự đi theo tối đa vài lần.
    private HttpURLConnection openFollowingRedirects(String url) throws Exception {
        for (int i = 0; i < 6; i++) {
            HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setInstanceFollowRedirects(false);
            conn.setConnectTimeout(20000);
            conn.setReadTimeout(30000);
            int code = conn.getResponseCode();
            if (code >= 300 && code < 400) {
                String next = conn.getHeaderField("Location");
                conn.disconnect();
                if (next == null) throw new Exception("chuyển hướng không có địa chỉ");
                url = new URL(new URL(url), next).toString();
                continue;
            }
            if (code != 200) {
                conn.disconnect();
                throw new Exception("máy chủ trả về mã " + code);
            }
            return conn;
        }
        throw new Exception("chuyển hướng quá nhiều lần");
    }
}
