#!/usr/bin/env python3
"""Донастройва генерирания Android проект (след `npx cap add android`):
разрешения за камера (сканиране на QR код) и мрежа, http връзка към компютъра и икони на приложението."""
import os
import re
import sys

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "android", "app", "src", "main")
MANIFEST = os.path.join(APP, "AndroidManifest.xml")
RES = os.path.join(APP, "res")
SRC = os.path.join(ROOT, "resources", "icon-source.png")
BG = "#2b0a62"   # среден тон от фона на логото
SPLASH_BG = "#0c0f22"   # фонът на приложението: тъмен начален екран вместо бял
JAVA = os.path.join(APP, "java", "bg", "tprompt", "app", "MainActivity.java")
GRADLE = os.path.join(ROOT, "android", "app", "build.gradle")

if not os.path.exists(MANIFEST):
    sys.exit("Няма android/ проект. Първо изпълнете: npx cap add android")

# ---- манифест
with open(MANIFEST, encoding="utf-8") as f:
    m = f.read()

perms = [
    '<uses-permission android:name="android.permission.CAMERA" />',
    '<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />',
    '<uses-permission android:name="android.permission.WAKE_LOCK" />',
    '<uses-feature android:name="android.hardware.camera" android:required="false" />',
    '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />',
]
missing = [p for p in perms if p.split('"')[1] not in m]
if missing:
    block = "".join("    " + p + "\n" for p in missing)
    m = m.replace("</manifest>", block + "</manifest>", 1)

if "usesCleartextTraffic" not in m:
    m = re.sub(r"<application", '<application android:usesCleartextTraffic="true"', m, count=1)

# основният прозорец е само в портрет; четецът сам сменя ориентацията през приставката за екрана
if "screenOrientation" not in m:
    m = re.sub(r"<activity", '<activity android:screenOrientation="portrait"', m, count=1)

with open(MANIFEST, "w", encoding="utf-8") as f:
    f.write(m)

# ---- икони
src = Image.open(SRC).convert("RGBA")
legacy = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
foreground = {"mdpi": 108, "hdpi": 162, "xhdpi": 216, "xxhdpi": 324, "xxxhdpi": 432}

for dens, size in legacy.items():
    d = os.path.join(RES, "mipmap-" + dens)
    os.makedirs(d, exist_ok=True)
    icon = src.resize((size, size), Image.LANCZOS)
    icon.save(os.path.join(d, "ic_launcher.png"))
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    round_icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    round_icon.paste(icon, (0, 0), mask)
    round_icon.save(os.path.join(d, "ic_launcher_round.png"))

for dens, size in foreground.items():
    d = os.path.join(RES, "mipmap-" + dens)
    os.makedirs(d, exist_ok=True)
    inner = int(size * 0.72)   # логото запълва видимата част на маската (72 от 108 dp), както другите икони
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.paste(src.resize((inner, inner), Image.LANCZOS), ((size - inner) // 2, (size - inner) // 2))
    canvas.save(os.path.join(d, "ic_launcher_foreground.png"))

vals = os.path.join(RES, "values")
os.makedirs(vals, exist_ok=True)

# икона за началния екран: Android 12+ изрязва иконата в кръг (2/3 от 288 dp), затова цялата плочка
# се смалява до 50% от платното - заоблените ъгли остават видими и логото не се реже
SPLASH_PX = 1152
nodpi = os.path.join(RES, "drawable-nodpi")
os.makedirs(nodpi, exist_ok=True)
tile = int(SPLASH_PX * 0.50)
splash = Image.new("RGBA", (SPLASH_PX, SPLASH_PX), (0, 0, 0, 0))
splash.paste(src.resize((tile, tile), Image.LANCZOS), ((SPLASH_PX - tile) // 2,) * 2)
splash.save(os.path.join(nodpi, "splash_icon.png"))

with open(os.path.join(vals, "ic_launcher_background.xml"), "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">%s</color>\n</resources>\n' % BG)

# ---- тъмен начален екран с иконата (вместо белия прозорец) и задържането му, докато интерфейсът е готов
with open(os.path.join(vals, "splash_colors.xml"), "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="splash_bg">%s</color>\n</resources>\n' % SPLASH_BG)

STYLES = """<?xml version="1.0" encoding="utf-8"?>
<resources>
    <style name="AppTheme" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="colorPrimary">@color/splash_bg</item>
        <item name="colorPrimaryDark">@color/splash_bg</item>
        <item name="android:windowBackground">@color/splash_bg</item>
        <item name="android:statusBarColor">@color/splash_bg</item>
        <item name="android:navigationBarColor">@color/splash_bg</item>
    </style>

    <style name="AppTheme.NoActionBar" parent="AppTheme">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
    </style>

    <style name="AppTheme.NoActionBarLaunch" parent="Theme.SplashScreen">
        <item name="windowSplashScreenBackground">@color/splash_bg</item>
        <item name="windowSplashScreenAnimatedIcon">@drawable/splash_icon</item>
        <item name="postSplashScreenTheme">@style/AppTheme.NoActionBar</item>
        <item name="android:windowBackground">@color/splash_bg</item>
    </style>
</resources>
"""
with open(os.path.join(vals, "styles.xml"), "w", encoding="utf-8") as f:
    f.write(STYLES)

with open(MANIFEST, encoding="utf-8") as f:
    m = f.read()
if "AppTheme.NoActionBarLaunch" not in m:
    m = re.sub(r"<activity", '<activity android:theme="@style/AppTheme.NoActionBarLaunch"', m, count=1)
with open(MANIFEST, "w", encoding="utf-8") as f:
    f.write(m)

MAIN = """package bg.tprompt.app;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.webkit.WebView;
import androidx.core.splashscreen.SplashScreen;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private volatile boolean ready = false;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private int tries = 0;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FileSaverPlugin.class);   /* запазване на файлове през системния прозорец (Файлове, Drive, pCloud...) */
        registerPlugin(TPServerPlugin.class);   /* малък HTTP сървър: Android като домакин (показва QR код) */
        SplashScreen splash = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);
        splash.setKeepOnScreenCondition(() -> !ready);
        handler.postDelayed(poll, 30);
    }

    /* страницата вдига window.__tpReady, когато интерфейсът е нарисуван; най-много 4 s (130 проверки през 30 ms) */
    private final Runnable poll = new Runnable() {
        @Override
        public void run() {
            if (ready) return;
            tries++;
            if (tries > 130 || getBridge() == null || getBridge().getWebView() == null) {
                if (tries > 130) ready = true; else handler.postDelayed(this, 30);
                return;
            }
            WebView wv = getBridge().getWebView();
            wv.evaluateJavascript("window.__tpReady===true", value -> {
                if ("true".equals(value)) ready = true;
                else handler.postDelayed(poll, 30);
            });
        }
    };
}
"""
os.makedirs(os.path.dirname(JAVA), exist_ok=True)
with open(JAVA, "w", encoding="utf-8") as f:
    f.write(MAIN)

# ---- запазване на файлове: WebView не поддържа сваляне през <a download>, затова "Файлът е запазен" не създаваше нищо.
# Приставката отваря системния прозорец „Запази като“ (ACTION_CREATE_DOCUMENT): потребителят избира къде - телефона, Drive, pCloud...
SAVER = """package bg.tprompt.app;

import android.app.Activity;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/* Файлове през системния прозорец на Android (телефон, Drive, pCloud...):
   save  - „Запази като“ (нов файл);
   pick  - „Отвори“ с трайно разрешение, за да може да се пише обратно в същия файл;
   read, write, stat - четене, запис и проверка на свързан файл. */
@CapacitorPlugin(name = "FileSaver")
public class FileSaverPlugin extends Plugin {

    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name", "tprompt.txt");
        String mime = call.getString("mime", "application/octet-stream");
        String data = call.getString("data");
        if (data == null) {
            call.reject("Няма данни за запис");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(mime);
        intent.putExtra(Intent.EXTRA_TITLE, name);
        startActivityForResult(call, intent, "saveResult");
    }

    @ActivityCallback
    private void saveResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject res = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            res.put("cancelled", true);
            call.resolve(res);
            return;
        }
        Uri uri = result.getData().getData();
        try {
            String d = call.getString("data", "");
            if (Boolean.TRUE.equals(call.getBoolean("b64", false))) {
                writeBytes(uri, Base64.decode(d, Base64.DEFAULT));   /* двоични файлове (.docx) идват като base64 */
            } else {
                writeText(uri, d);
            }
        } catch (Exception e) {
            call.reject("Записът не успя: " + e.getMessage());
            return;
        }
        res.put("cancelled", false);
        res.put("uri", uri.toString());
        call.resolve(res);
    }

    @PluginMethod
    public void pick(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);
        startActivityForResult(call, intent, "pickResult");
    }

    @ActivityCallback
    private void pickResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            JSObject res = new JSObject();
            res.put("cancelled", true);
            call.resolve(res);
            return;
        }
        Uri uri = result.getData().getData();
        try {
            getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        } catch (Exception e) {
            try {
                getContext().getContentResolver().takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            } catch (Exception e2) {
                /* без трайно разрешение: файлът се отваря, но няма да се пази връзка */
            }
        }
        try {
            JSObject res = describe(uri);
            res.put("cancelled", false);
            res.put("data", readBase64(uri));
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Четенето не успя: " + e.getMessage());
        }
    }

    @PluginMethod
    public void read(PluginCall call) {
        String u = call.getString("uri");
        if (u == null) {
            call.reject("Няма адрес на файл");
            return;
        }
        try {
            Uri uri = Uri.parse(u);
            refresh(uri);   /* Google Drive и др.: молба да се вземе последната версия от облака */
            String data = readBase64(uri);
            JSObject res = describe(uri);   /* часът се взема след четенето, за да не е по-стар от съдържанието */
            res.put("data", data);
            call.resolve(res);
        } catch (Exception e) {
            call.reject("Четенето не успя: " + e.getMessage());
        }
    }

    @PluginMethod
    public void write(PluginCall call) {
        String u = call.getString("uri");
        String data = call.getString("data");
        if (u == null || data == null) {
            call.reject("Няма данни за запис");
            return;
        }
        try {
            Uri uri = Uri.parse(u);
            if (Boolean.TRUE.equals(call.getBoolean("b64", false))) {
                writeBytes(uri, Base64.decode(data, Base64.DEFAULT));   /* двоични файлове (.docx, .odt) идват като base64 */
            } else {
                writeText(uri, data);
            }
            call.resolve(describe(uri));
        } catch (Exception e) {
            call.reject("Записът не успя: " + e.getMessage());
        }
    }

    @PluginMethod
    public void stat(PluginCall call) {
        String u = call.getString("uri");
        if (u == null) {
            call.reject("Няма адрес на файл");
            return;
        }
        try {
            Uri uri = Uri.parse(u);
            refresh(uri);
            call.resolve(describe(uri));
        } catch (Exception e) {
            call.reject("Файлът не е достъпен: " + e.getMessage());
        }
    }

    /* доставчиците, които го поддържат (Android 8+), обновяват данните си от облака; другите просто го пренебрегват */
    private void refresh(Uri uri) {
        if (Build.VERSION.SDK_INT < 26) return;
        try {
            getContext().getContentResolver().refresh(uri, null, null);
        } catch (Exception e) {
            /* не е задължително */
        }
    }

    private void writeText(Uri uri, String data) throws Exception {
        writeBytes(uri, data.getBytes("UTF-8"));
    }

    private void writeBytes(Uri uri, byte[] bytes) throws Exception {
        OutputStream os;
        try {
            os = getContext().getContentResolver().openOutputStream(uri, "wt");
        } catch (Exception e) {
            os = getContext().getContentResolver().openOutputStream(uri, "w");
        }
        if (os == null) throw new Exception("няма достъп до файла");
        try {
            os.write(bytes);
            os.flush();
        } finally {
            os.close();
        }
    }

    private String readBase64(Uri uri) throws Exception {
        InputStream is = getContext().getContentResolver().openInputStream(uri);
        if (is == null) throw new Exception("няма достъп до файла");
        try {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = is.read(buf)) > 0) bos.write(buf, 0, n);
            return Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
        } finally {
            is.close();
        }
    }

    private JSObject describe(Uri uri) {
        JSObject o = new JSObject();
        o.put("uri", uri.toString());
        o.put("name", "");
        o.put("mime", "");
        o.put("size", 0);
        o.put("mt", 0);
        o.put("writable", false);
        Cursor c = null;
        try {
            c = getContext().getContentResolver().query(uri, new String[]{
                DocumentsContract.Document.COLUMN_DISPLAY_NAME,
                DocumentsContract.Document.COLUMN_MIME_TYPE,
                DocumentsContract.Document.COLUMN_SIZE,
                DocumentsContract.Document.COLUMN_LAST_MODIFIED,
                DocumentsContract.Document.COLUMN_FLAGS}, null, null, null);
            if (c != null && c.moveToFirst()) {
                if (!c.isNull(0)) o.put("name", c.getString(0));
                if (!c.isNull(1)) o.put("mime", c.getString(1));
                if (!c.isNull(2)) o.put("size", c.getLong(2));
                if (!c.isNull(3)) o.put("mt", c.getLong(3));
                if (!c.isNull(4)) o.put("writable", (c.getInt(4) & DocumentsContract.Document.FLAG_SUPPORTS_WRITE) != 0);
            }
        } catch (Exception e) {
            /* някои доставчици не връщат всички полета */
        } finally {
            if (c != null) c.close();
        }
        return o;
    }
}
"""
with open(os.path.join(os.path.dirname(JAVA), "FileSaverPlugin.java"), "w", encoding="utf-8") as f:
    f.write(SAVER)

# ---- Android като „домакин“: малък HTTP сървър (приставка TPServer) за показване на QR код и приемане на връзка
import shutil

shutil.copyfile(os.path.join(ROOT, "scripts", "TPServerPlugin.java"), os.path.join(os.path.dirname(JAVA), "TPServerPlugin.java"))
assets = os.path.join(APP, "assets")
os.makedirs(assets, exist_ok=True)
shutil.copyfile(os.path.join(ROOT, "src-tauri", "src", "remote.html"), os.path.join(assets, "remote.html"))   # уеб страницата за браузър на другото устройство

if os.path.exists(GRADLE):
    with open(GRADLE, encoding="utf-8") as f:
        g = f.read()
    deps = []
    if "core-splashscreen" not in g:
        deps.append('    implementation "androidx.core:core-splashscreen:1.0.1"')
    if "nanohttpd" not in g:
        deps.append('    implementation "org.nanohttpd:nanohttpd:2.3.1"')
    if deps:
        g = re.sub(r"dependencies\s*\{", "dependencies {\n" + "\n".join(deps), g, count=1)
        with open(GRADLE, "w", encoding="utf-8") as f:
            f.write(g)

print("Android проектът е донастроен.")
