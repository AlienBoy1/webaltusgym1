package gym.qyntra.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONObject;

/**
 * Messenger-style floating chat panel over other apps.
 * Shown when the user taps a chat head while outside Qyntra.
 */
public final class ChatPanelOverlay {
    private static final String TAG = "ChatPanelOverlay";
    private static WindowManager windowManager;
    private static View panelRoot;
    private static WindowManager.LayoutParams panelLp;

    private ChatPanelOverlay() {}

    public static boolean canDraw(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context);
    }

    public static void hide(Context context) {
        try {
            Context app = context.getApplicationContext();
            ensureWm(app);
            if (windowManager != null && panelRoot != null && panelRoot.getParent() != null) {
                windowManager.removeView(panelRoot);
            }
        } catch (Exception e) {
            Log.e(TAG, "hide failed", e);
        }
        panelRoot = null;
    }

    public static void show(Context context, String peerId, String name, String avatarUrl, String wallpaperId) {
        if (peerId == null || peerId.isEmpty() || !canDraw(context)) return;

        if (MainActivity.isInForeground()) {
            openInApp(context, peerId, name);
            return;
        }

        try {
            Context app = context.getApplicationContext();
            ensureWm(app);
            hide(app);

            ChatBubbleStore.PeerMeta meta = ChatBubbleStore.peerMeta(app, peerId);
            final String peerName = (name != null && !name.isEmpty() && !"Usuario".equalsIgnoreCase(name))
                ? name
                : (meta.name != null && !meta.name.isEmpty() ? meta.name : "Chat");
            final String avatar = (avatarUrl != null && !avatarUrl.isEmpty())
                ? avatarUrl
                : (meta.avatar != null ? meta.avatar : "");
            final String wallpaper = (wallpaperId != null && !wallpaperId.isEmpty())
                ? wallpaperId
                : (meta.wallpaper != null ? meta.wallpaper : "none");

            DisplayMetrics dm = app.getResources().getDisplayMetrics();
            int width = Math.min(dm.widthPixels - dp(app, 16), dp(app, 420));
            int height = Math.min((int) (dm.heightPixels * 0.72f), dp(app, 640));

            LinearLayout root = new LinearLayout(app);
            root.setOrientation(LinearLayout.VERTICAL);
            GradientDrawable bg = new GradientDrawable();
            bg.setColor(0xF0121218);
            bg.setCornerRadius(dp(app, 18));
            bg.setStroke(dp(app, 1), 0x33FFFFFF);
            root.setBackground(bg);
            root.setElevation(dp(app, 12));

            LinearLayout header = new LinearLayout(app);
            header.setOrientation(LinearLayout.HORIZONTAL);
            header.setGravity(Gravity.CENTER_VERTICAL);
            header.setPadding(dp(app, 12), dp(app, 10), dp(app, 8), dp(app, 10));
            header.setBackgroundColor(0xE61A1A24);

            ChatBubbleView head = new ChatBubbleView(app);
            head.setPeerName(peerName);
            head.setAvatarUrl(avatar);
            head.setUnread(1);
            header.addView(head, new LinearLayout.LayoutParams(dp(app, 40), dp(app, 40)));

            LinearLayout titles = new LinearLayout(app);
            titles.setOrientation(LinearLayout.VERTICAL);
            titles.setPadding(dp(app, 10), 0, dp(app, 6), 0);
            TextView nameTv = new TextView(app);
            nameTv.setText(peerName);
            nameTv.setTextColor(Color.WHITE);
            nameTv.setTextSize(15f);
            nameTv.setMaxLines(1);
            TextView subTv = new TextView(app);
            subTv.setText("Chat flotante · menú en la app");
            subTv.setTextColor(0x99FFFFFF);
            subTv.setTextSize(11f);
            titles.addView(nameTv);
            titles.addView(subTv);
            header.addView(titles, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

            TextView menuBtn = textBtn(app, "⋮");
            TextView openBtn = textBtn(app, "↗");
            TextView closeBtn = textBtn(app, "×");
            header.addView(menuBtn);
            header.addView(openBtn);
            header.addView(closeBtn);
            root.addView(header, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

            WebView web = new WebView(app);
            WebSettings ws = web.getSettings();
            ws.setJavaScriptEnabled(true);
            ws.setDomStorageEnabled(true);
            ws.setAllowFileAccess(false);
            web.setBackgroundColor(Color.TRANSPARENT);
            web.setWebViewClient(new WebViewClient());
            web.addJavascriptInterface(new PanelBridge(app, peerId), "QyntraChatPanel");
            root.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

            panelLp = new WindowManager.LayoutParams(
                width,
                height,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                    | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                    | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT
            );
            panelLp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            panelLp.y = dp(app, 28);

            header.setOnTouchListener(new View.OnTouchListener() {
                private int startX;
                private int startY;
                private float touchX;
                private float touchY;

                @Override
                public boolean onTouch(View v, MotionEvent event) {
                    switch (event.getAction()) {
                        case MotionEvent.ACTION_DOWN:
                            startX = panelLp.x;
                            startY = panelLp.y;
                            touchX = event.getRawX();
                            touchY = event.getRawY();
                            return true;
                        case MotionEvent.ACTION_MOVE:
                            panelLp.x = startX + Math.round(event.getRawX() - touchX);
                            panelLp.y = Math.max(dp(app, 8), startY - Math.round(event.getRawY() - touchY));
                            try {
                                windowManager.updateViewLayout(root, panelLp);
                            } catch (Exception ignored) {}
                            return true;
                        default:
                            return false;
                    }
                }
            });

            closeBtn.setOnClickListener(v -> hide(app));
            openBtn.setOnClickListener(v -> {
                hide(app);
                openInApp(app, peerId, peerName);
            });
            menuBtn.setOnClickListener(v -> {
                hide(app);
                openInApp(app, peerId, peerName);
            });

            windowManager.addView(root, panelLp);
            panelRoot = root;

            ChatBubbleStore.cancelNotification(app, peerId);
            ChatBubbleStore.postChatReceipt(app, peerId, "read");

            web.loadDataWithBaseURL("https://qyntra.local/", buildHtml(wallpaper), "text/html", "UTF-8", null);
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    String token = ChatBubbleStore.authToken(app);
                    web.evaluateJavascript(
                        "window.__boot&&window.__boot(" +
                            JSONObject.quote(peerId) + "," +
                            JSONObject.quote(ChatBubbleStore.apiBase(app)) + "," +
                            JSONObject.quote(token != null ? token : "") +
                            ")",
                        null
                    );
                } catch (Exception e) {
                    Log.e(TAG, "boot js failed", e);
                }
            }, 280);
        } catch (Exception e) {
            Log.e(TAG, "show failed", e);
        }
    }

    private static void openInApp(Context context, String peerId, String name) {
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra("open_path", "/chat");
        open.putExtra("chat_peer_id", peerId);
        open.putExtra("chat_peer_name", name != null ? name : "");
        context.startActivity(open);
    }

    private static TextView textBtn(Context app, String label) {
        TextView tv = new TextView(app);
        tv.setText(label);
        tv.setTextColor(Color.WHITE);
        tv.setTextSize(18f);
        tv.setPadding(dp(app, 10), dp(app, 6), dp(app, 10), dp(app, 6));
        tv.setClickable(true);
        return tv;
    }

    private static int dp(Context context, int v) {
        return Math.round(v * context.getResources().getDisplayMetrics().density);
    }

    private static void ensureWm(Context app) {
        if (windowManager == null) {
            windowManager = (WindowManager) app.getSystemService(Context.WINDOW_SERVICE);
        }
    }

    private static String wallpaperCss(String id) {
        if (id == null) id = "none";
        switch (id) {
            case "nebula":
                return "background:linear-gradient(135deg,#1a0a08,#FF6B35 45%,#00F5FF);";
            case "grid":
                return "background:linear-gradient(135deg,#111,#FF6B35 55%,#222);";
            case "aurora":
                return "background:linear-gradient(135deg,#00F5FF,#7C3AED,#FF6B35);";
            case "pulse":
                return "background:radial-gradient(circle,#7f1d1d,#111);";
            case "waves":
                return "background:linear-gradient(135deg,#0369a1,#22d3ee);";
            case "ember":
                return "background:linear-gradient(180deg,#1c0802,#ea580c 50%,#fbbf24);";
            case "mist":
                return "background:linear-gradient(135deg,#111,#555,#222);";
            case "orbit":
                return "background:radial-gradient(circle,#1e293b,#fbbf24 45%,#0f172a);";
            default:
                return "background:#0c0c10;";
        }
    }

    private static String buildHtml(String wallpaper) {
        String wall = wallpaperCss(wallpaper);
        return "<!DOCTYPE html><html><head><meta charset=utf-8>"
            + "<meta name=viewport content='width=device-width,initial-scale=1,maximum-scale=1'>"
            + "<style>"
            + "*{box-sizing:border-box}html,body{height:100%;margin:0}"
            + "body{font-family:system-ui,-apple-system,sans-serif;color:#fff;" + wall + "}"
            + "#msgs{padding:10px 12px 70px;overflow-y:auto;height:100%;display:flex;flex-direction:column;gap:8px}"
            + ".row{display:flex}.row.me{justify-content:flex-end}.row.them{justify-content:flex-start}"
            + ".b{max-width:82%;padding:8px 12px;border-radius:16px;font-size:14px;line-height:1.35;word-break:break-word}"
            + ".me .b{background:#FF6B35;border-bottom-right-radius:6px}.them .b{background:rgba(255,255,255,.12);border-bottom-left-radius:6px}"
            + "#bar{position:absolute;left:0;right:0;bottom:0;display:flex;gap:8px;padding:8px;background:rgba(12,12,16,.94);border-top:1px solid rgba(255,255,255,.08)}"
            + "#inp{flex:1;border:0;border-radius:18px;padding:10px 14px;background:rgba(255,255,255,.08);color:#fff;outline:none}"
            + "#send{border:0;border-radius:18px;padding:0 16px;background:#FF6B35;color:#fff;font-weight:700}"
            + ".muted{opacity:.65;font-size:12px;text-align:center;padding:12px}"
            + "</style></head><body>"
            + "<div id=msgs><div class=muted>Cargando chat…</div></div>"
            + "<div id=bar><input id=inp placeholder='Mensaje.' /><button id=send>Enviar</button></div>"
            + "<script>"
            + "let PEER='',API='',TOKEN='';"
            + "const msgs=document.getElementById('msgs');"
            + "const inp=document.getElementById('inp');"
            + "const sendBtn=document.getElementById('send');"
            + "function esc(s){return String(s||'').replace(/[&<>\"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;' }[c]));}"
            + "function add(m){const me=m.sender==='me';const d=document.createElement('div');d.className='row '+(me?'me':'them');"
            + "d.innerHTML='<div class=b>'+esc(m.text||m.preview||'')+'</div>';msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;}"
            + "async function load(){try{const r=await fetch(API+'/chat/messages/'+encodeURIComponent(PEER),{headers:{Authorization:'Bearer '+TOKEN}});"
            + "const data=await r.json();msgs.innerHTML='';(Array.isArray(data)?data:[]).slice(-60).forEach(add);"
            + "if(!msgs.children.length)msgs.innerHTML='<div class=muted>Sin mensajes aún</div>';msgs.scrollTop=msgs.scrollHeight;"
            + "try{QyntraChatPanel.markRead(PEER)}catch(e){}}catch(e){msgs.innerHTML='<div class=muted>No se pudo cargar</div>';}}"
            + "async function send(){const t=(inp.value||'').trim();if(!t)return;inp.value='';add({sender:'me',text:t});"
            + "try{await fetch(API+'/chat/send',{method:'POST',headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'},"
            + "body:JSON.stringify({to:PEER,content:t})});}catch(e){}}"
            + "sendBtn.onclick=send;inp.onkeydown=e=>{if(e.key==='Enter')send()};"
            + "window.__boot=function(peer,api,token){PEER=peer;API=String(api||'').replace(/\\/$/,'');TOKEN=token||'';load();};"
            + "</script></body></html>";
    }

    public static final class PanelBridge {
        private final Context app;
        private final String peerId;

        PanelBridge(Context app, String peerId) {
            this.app = app.getApplicationContext();
            this.peerId = peerId;
        }

        @JavascriptInterface
        public void markRead(String peer) {
            String id = peer != null && !peer.isEmpty() ? peer : peerId;
            ChatBubbleStore.postChatReceipt(app, id, "read");
            ChatBubbleStore.cancelNotification(app, id);
        }

        @JavascriptInterface
        public void close() {
            new Handler(Looper.getMainLooper()).post(() -> ChatPanelOverlay.hide(app));
        }
    }
}
