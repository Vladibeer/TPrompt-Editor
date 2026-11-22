package bg.tprompt.app;

import android.os.SystemClock;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import fi.iki.elonen.NanoHTTPD;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;

/* Малък HTTP сървър за Android в роля „домакин“ (показва QR код и се управлява от другото устройство).
   Повтаря точно сървъра на Windows (src-tauri/src/lib.rs): същите адреси, същата проверка на кода (?t=…) и същите опашки,
   затова приложението на другото устройство (и уеб страницата remote.html) не личи с какво е свързано.
   Командите на приставката имат имената на командите на Tauri, а JavaScript-ът на домакина е един и същ и за двете платформи. */
@CapacitorPlugin(name = "TPServer")
public class TPServerPlugin extends Plugin {
    private static final int FIRST_PORT = 8723;
    private static final int PORT_TRIES = 20;
    private static final int MAX_QUEUE = 500;
    private static final String TOKEN_AB = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

    private final Object lock = new Object();
    private final SecureRandom rnd = new SecureRandom();
    private Srv server;
    private String token = "";
    private int port = 0;
    private String stateJson = "";
    private String contentJson = "";
    private final List<String> cmds = new ArrayList<>();      // команди от уеб дистанционното
    private final List<String> rxMsgs = new ArrayList<>();    // съобщения от приложението на другото устройство
    private final List<String> tx = new ArrayList<>();        // съобщения към другото устройство
    private long rxSeq = 0;
    private Object rxSt = JSONObject.NULL;
    private long wseq = 0;
    private String want = "";
    private long lastRx = 0;    // 0 = още няма
    private long lastWeb = 0;
    private String remoteHtml = null;

    // ------------------------------------------------------------ сървър

    private class Srv extends NanoHTTPD {
        Srv(int p) {
            super(p);
        }

        @Override
        public NanoHTTPD.Response serve(IHTTPSession s) {
            try {
                return handle(s);
            } catch (Exception e) {
                return resp(500, "application/json", "{\"error\":\"internal\"}");
            }
        }
    }

    private static NanoHTTPD.Response.Status status(int code) {
        switch (code) {
            case 200: return NanoHTTPD.Response.Status.OK;
            case 204: return NanoHTTPD.Response.Status.NO_CONTENT;
            case 403: return NanoHTTPD.Response.Status.FORBIDDEN;
            case 404: return NanoHTTPD.Response.Status.NOT_FOUND;
            default: return NanoHTTPD.Response.Status.INTERNAL_ERROR;
        }
    }

    private static NanoHTTPD.Response resp(int code, String mime, String body) {
        NanoHTTPD.Response r = NanoHTTPD.newFixedLengthResponse(status(code), mime, body);
        r.addHeader("Cache-Control", "no-store");
        r.addHeader("Access-Control-Allow-Origin", "*");
        r.addHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        r.addHeader("Access-Control-Allow-Headers", "Content-Type");
        r.addHeader("Access-Control-Allow-Private-Network", "true");
        return r;
    }

    private String loadRemoteHtml() {
        if (remoteHtml != null) return remoteHtml;
        try (InputStream in = getContext().getAssets().open("remote.html")) {
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
            remoteHtml = out.toString("UTF-8");
        } catch (Exception e) {
            remoteHtml = "<!doctype html><meta charset=utf-8><title>TPrompt</title><p>remote.html липсва в приложението.</p>";
        }
        return remoteHtml;
    }

    private NanoHTTPD.Response handle(NanoHTTPD.IHTTPSession s) throws Exception {
        NanoHTTPD.Method method = s.getMethod();
        if (method == NanoHTTPD.Method.OPTIONS) return resp(204, "text/plain", "");
        Map<String, String> parms = s.getParms();
        String tok = parms.get("t");
        boolean ok;
        synchronized (lock) {
            ok = !token.isEmpty() && token.equals(tok);
        }
        if (!ok) return resp(403, "application/json", "{\"error\":\"forbidden\"}");

        String body = "";
        if (method == NanoHTTPD.Method.POST) {
            Map<String, String> files = new java.util.HashMap<>();
            s.parseBody(files);
            String pd = files.get("postData");
            body = pd == null ? "" : pd;
        }
        String path = s.getUri();
        boolean post = method == NanoHTTPD.Method.POST;
        long now = SystemClock.elapsedRealtime();

        if (!post && "/".equals(path)) {
            synchronized (lock) { lastWeb = now; }
            return resp(200, "text/html; charset=utf-8", loadRemoteHtml());
        }
        if (!post && "/api/rx/state".equals(path)) {
            boolean wantTx = "1".equals(parms.get("tx"));
            JSONObject out = new JSONObject();
            synchronized (lock) {
                lastRx = now;
                JSONArray txArr = new JSONArray();
                if (wantTx) {
                    for (String m : tx) {
                        try { txArr.put(new JSONTokener(m).nextValue()); } catch (Exception e) { /* повредено съобщение */ }
                    }
                    tx.clear();
                }
                JSONObject st = new JSONObject();
                st.put("seq", rxSeq);
                st.put("st", rxSt);
                out.put("now", System.currentTimeMillis());
                out.put("st", st);
                out.put("wseq", wseq);
                out.put("want", want);
                out.put("tx", txArr);
            }
            return resp(200, "application/json", out.toString());
        }
        if (post && "/api/rx/send".equals(path)) {
            synchronized (lock) {
                lastRx = now;
                if (rxMsgs.size() < MAX_QUEUE) rxMsgs.add(body);
            }
            return resp(200, "application/json", "{\"ok\":true}");
        }
        if (!post && "/api/state".equals(path)) {
            String st;
            synchronized (lock) {
                lastWeb = now;
                st = stateJson.isEmpty() ? "{}" : stateJson;
            }
            return resp(200, "application/json", st);
        }
        if (!post && "/api/content".equals(path)) {
            String c;
            synchronized (lock) {
                lastWeb = now;
                c = contentJson.isEmpty() ? "{\"rev\":0,\"html\":\"\",\"css\":{}}" : contentJson;
            }
            return resp(200, "application/json", c);
        }
        if (post && "/api/cmd".equals(path)) {
            synchronized (lock) {
                lastWeb = now;
                if (cmds.size() < 100) cmds.add(body);
            }
            return resp(200, "application/json", "{\"ok\":true}");
        }
        return resp(404, "application/json", "{\"error\":\"not found\"}");
    }

    // ------------------------------------------------------------ помощни

    private String genToken() {
        StringBuilder sb = new StringBuilder(16);
        for (int i = 0; i < 16; i++) sb.append(TOKEN_AB.charAt(rnd.nextInt(TOKEN_AB.length())));
        return sb.toString();
    }

    private static boolean tokenOk(String t) {
        return t != null && t.matches("[A-Za-z0-9_-]{6,64}");
    }

    /* адресът на устройството в локалната мрежа: Wi‑Fi, точка за достъп или кабел (не мобилни данни и не VPN) */
    private static String lanIp() {
        String best = null;
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                String name = ni.getName().toLowerCase();
                if (name.startsWith("rmnet") || name.startsWith("tun") || name.startsWith("dummy") || name.startsWith("ccmni") || name.startsWith("pdp") || name.startsWith("v4-")) continue;
                for (InetAddress a : Collections.list(ni.getInetAddresses())) {
                    if (!(a instanceof Inet4Address) || a.isLoopbackAddress() || !a.isSiteLocalAddress()) continue;
                    if (name.startsWith("wlan") || name.startsWith("swlan") || name.startsWith("ap") || name.startsWith("eth")) return a.getHostAddress();
                    if (best == null) best = a.getHostAddress();
                }
            }
        } catch (Exception e) { /* няма мрежа */ }
        return best != null ? best : "127.0.0.1";
    }

    private JSObject info() {
        JSObject o = new JSObject();
        synchronized (lock) {
            o.put("url", "http://" + lanIp() + ":" + port + "/?t=" + token);
            o.put("token", token);
            o.put("port", port);
        }
        return o;
    }

    private void stopServer() {
        Srv s;
        synchronized (lock) {
            s = server;
            server = null;
        }
        if (s != null) {
            try { s.stop(); } catch (Exception e) { /* вече е спрян */ }
        }
    }

    private Object ago(long t) {
        return t == 0 ? JSONObject.NULL : (Object) (SystemClock.elapsedRealtime() - t);
    }

    @Override
    protected void handleOnDestroy() {
        stopServer();
        super.handleOnDestroy();
    }

    // ------------------------------------------------------------ команди (имената са като в Tauri)

    @PluginMethod
    public void remote_start(PluginCall call) {
        stopServer();
        String t = call.getString("token");
        if (!tokenOk(t)) t = genToken();
        Srv srv = null;
        int bound = 0;
        for (int p = FIRST_PORT; p < FIRST_PORT + PORT_TRIES; p++) {
            try {
                Srv s = new Srv(p);
                s.start(NanoHTTPD.SOCKET_READ_TIMEOUT, true);
                srv = s;
                bound = p;
                break;
            } catch (IOException e) { /* портът е зает: следващият */ }
        }
        if (srv == null) {
            call.reject("Не успях да отворя порт за дистанционното. Проверете връзката.");
            return;
        }
        synchronized (lock) {
            token = t;
            port = bound;
            cmds.clear();
            rxMsgs.clear();
            tx.clear();
            rxSt = JSONObject.NULL;
            rxSeq = 0;
            lastRx = 0;
            lastWeb = 0;
            server = srv;
        }
        call.resolve(info());
    }

    @PluginMethod
    public void remote_stop(PluginCall call) {
        stopServer();
        synchronized (lock) {
            token = "";
            cmds.clear();
            rxMsgs.clear();
            tx.clear();
        }
        call.resolve();
    }

    @PluginMethod
    public void remote_new_token(PluginCall call) {
        synchronized (lock) {
            token = genToken();
        }
        call.resolve(info());
    }

    @PluginMethod
    public void remote_set_content(PluginCall call) {
        String c = call.getString("contentJson", "");
        synchronized (lock) {
            contentJson = c == null ? "" : c;
        }
        call.resolve();
    }

    /* главната страница праща състоянието си и получава командите от уеб дистанционното */
    @PluginMethod
    public void remote_sync(PluginCall call) {
        String sj = call.getString("stateJson", "");
        JSArray arr = new JSArray();
        synchronized (lock) {
            stateJson = sj == null ? "" : sj;
            for (String c : cmds) arr.put(c);
            cmds.clear();
        }
        JSObject ret = new JSObject();
        ret.put("v", arr);
        call.resolve(ret);
    }

    @PluginMethod
    public void remote_want(PluginCall call) {
        Boolean view = call.getBoolean("view", false);
        synchronized (lock) {
            wseq++;
            want = Boolean.TRUE.equals(view) ? "view" : "";
        }
        call.resolve();
    }

    @PluginMethod
    public void tx_push(PluginCall call) {
        String m = call.getString("msgJson");
        synchronized (lock) {
            if (m != null && tx.size() < MAX_QUEUE) tx.add(m);
        }
        call.resolve();
    }

    @PluginMethod
    public void tx_clear(PluginCall call) {
        synchronized (lock) {
            tx.clear();
        }
        call.resolve();
    }

    /* приема съобщенията на приложението на другото устройство и подава състоянието на четеца към него */
    @PluginMethod
    public void rx_pump(PluginCall call) {
        String rxState = call.getString("rxState", "");
        JSArray msgs = new JSArray();
        JSObject ret = new JSObject();
        synchronized (lock) {
            if (rxState != null && !rxState.isEmpty()) {
                try {
                    JSONObject v = new JSONObject(rxState);
                    rxSeq = v.optLong("seq", rxSeq);
                    rxSt = v.has("st") ? v.get("st") : JSONObject.NULL;
                } catch (Exception e) { /* повредено състояние */ }
            }
            for (String m : rxMsgs) msgs.put(m);
            rxMsgs.clear();
            ret.put("msgs", msgs);
            ret.put("rxAgo", ago(lastRx));
            ret.put("webAgo", ago(lastWeb));
        }
        call.resolve(ret);
    }
}
