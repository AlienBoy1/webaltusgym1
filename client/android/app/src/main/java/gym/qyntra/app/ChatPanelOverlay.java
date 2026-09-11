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
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import org.json.JSONObject;

/**
 * Messenger-style floating chat panel over other apps.
 * Full-bleed bottom sheet; minimizes the chat head while open.
 */
public final class ChatPanelOverlay {
    private static final String TAG = "ChatPanelOverlay";
    private static WindowManager windowManager;
    private static View panelRoot;
    private static WindowManager.LayoutParams panelLp;
    private static String minimizedPeerId;
    private static String minimizedName;
    private static String minimizedAvatar;
    private static boolean restoreHeadOnClose = true;

    private ChatPanelOverlay() {}

    public static boolean canDraw(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context);
    }

    public static boolean isShowing() {
        return panelRoot != null && panelRoot.getParent() != null;
    }

    public static void hide(Context context) {
        hide(context, true);
    }

    public static void hide(Context context, boolean restoreHead) {
        Context app = context.getApplicationContext();
        try {
            ensureWm(app);
            if (windowManager != null && panelRoot != null && panelRoot.getParent() != null) {
                windowManager.removeView(panelRoot);
            }
        } catch (Exception e) {
            Log.e(TAG, "hide failed", e);
        }
        panelRoot = null;

        final String peer = minimizedPeerId;
        final String name = minimizedName;
        final String avatar = minimizedAvatar;
        minimizedPeerId = null;
        minimizedName = null;
        minimizedAvatar = null;

        if (restoreHead && restoreHeadOnClose && peer != null && !peer.isEmpty()
            && !MainActivity.isInForeground()
            && ChatBubbleStore.isEnabled(app, peer)
            && canDraw(app)) {
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    ChatBubbleOverlay.show(app, peer, name, "", 1, avatar);
                } catch (Exception e) {
                    Log.e(TAG, "restore head failed", e);
                }
            }, 120);
        }
        restoreHeadOnClose = true;
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
            // Closing previous panel without restoring its head
            restoreHeadOnClose = false;
            hide(app, false);

            ChatBubbleStore.PeerMeta meta = ChatBubbleStore.peerMeta(app, peerId);
            final String peerName = (name != null && !name.isEmpty() && !"Usuario".equalsIgnoreCase(name))
                ? name
                : (meta.name != null && !meta.name.isEmpty() ? meta.name : "Chat");
            final String avatar = (avatarUrl != null && !avatarUrl.isEmpty())
                ? avatarUrl
                : (meta.avatar != null ? meta.avatar : "");
            final String wallpaper = (wallpaperId != null && !wallpaperId.isEmpty() && !"null".equals(wallpaperId))
                ? wallpaperId
                : (meta.wallpaper != null ? meta.wallpaper : "none");
            final boolean bubbleOn = ChatBubbleStore.isEnabled(app, peerId);

            // Minimize chat head while panel is open (Messenger behavior)
            ChatBubbleOverlay.hide(app, peerId);
            minimizedPeerId = peerId;
            minimizedName = peerName;
            minimizedAvatar = avatar;
            restoreHeadOnClose = true;

            DisplayMetrics dm = app.getResources().getDisplayMetrics();
            // Near full-screen like Messenger chat bubble expanded
            int width = dm.widthPixels - dp(app, 8);
            int height = (int) (dm.heightPixels * 0.88f);
            int bottomGap = dp(app, 10);

            FrameLayout root = new FrameLayout(app);
            GradientDrawable bg = new GradientDrawable();
            bg.setColor(0xF80E0E14);
            bg.setCornerRadius(dp(app, 20));
            bg.setStroke(dp(app, 1), 0x40FFFFFF);
            root.setBackground(bg);
            root.setElevation(dp(app, 16));
            root.setClipToOutline(true);

            LinearLayout column = new LinearLayout(app);
            column.setOrientation(LinearLayout.VERTICAL);
            root.addView(column, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            ));

            LinearLayout header = new LinearLayout(app);
            header.setOrientation(LinearLayout.HORIZONTAL);
            header.setGravity(Gravity.CENTER_VERTICAL);
            header.setPadding(dp(app, 12), dp(app, 12), dp(app, 6), dp(app, 12));
            header.setBackgroundColor(0xF01A1A24);

            ChatBubbleView head = new ChatBubbleView(app);
            head.setPeerName(peerName);
            head.setAvatarUrl(avatar);
            head.setUnread(1);
            header.addView(head, new LinearLayout.LayoutParams(dp(app, 44), dp(app, 44)));

            LinearLayout titles = new LinearLayout(app);
            titles.setOrientation(LinearLayout.VERTICAL);
            titles.setPadding(dp(app, 10), 0, dp(app, 6), 0);
            TextView nameTv = new TextView(app);
            nameTv.setText(peerName);
            nameTv.setTextColor(Color.WHITE);
            nameTv.setTextSize(16f);
            nameTv.setMaxLines(1);
            TextView subTv = new TextView(app);
            subTv.setText("Chat flotante");
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
            column.addView(header, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

            WebView web = new WebView(app);
            WebSettings ws = web.getSettings();
            ws.setJavaScriptEnabled(true);
            ws.setDomStorageEnabled(true);
            ws.setAllowFileAccess(false);
            web.setBackgroundColor(Color.TRANSPARENT);
            web.setWebViewClient(new WebViewClient());
            web.addJavascriptInterface(new PanelBridge(app, peerId, peerName), "QyntraChatPanel");
            column.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

            // Dropdown menu overlay (native)
            final LinearLayout menuSheet = buildMenuSheet(app, peerId, peerName, bubbleOn, wallpaper);
            menuSheet.setVisibility(View.GONE);
            FrameLayout.LayoutParams menuLp = new FrameLayout.LayoutParams(
                dp(app, 260),
                ViewGroup.LayoutParams.WRAP_CONTENT
            );
            menuLp.gravity = Gravity.TOP | Gravity.END;
            menuLp.topMargin = dp(app, 58);
            menuLp.rightMargin = dp(app, 10);
            root.addView(menuSheet, menuLp);

            panelLp = new WindowManager.LayoutParams(
                width,
                height,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                    | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT
            );
            panelLp.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
            panelLp.y = bottomGap;
            panelLp.x = 0;

            header.setOnTouchListener(new View.OnTouchListener() {
                private int startY;
                private float touchY;
                private boolean dragging;

                @Override
                public boolean onTouch(View v, MotionEvent event) {
                    switch (event.getAction()) {
                        case MotionEvent.ACTION_DOWN:
                            startY = panelLp.y;
                            touchY = event.getRawY();
                            dragging = false;
                            return true;
                        case MotionEvent.ACTION_MOVE: {
                            float dy = event.getRawY() - touchY;
                            if (Math.abs(dy) > 8) dragging = true;
                            // Drag down to dismiss (Messenger-like)
                            int nextY = Math.max(dp(app, 4), startY - Math.round(dy));
                            panelLp.y = nextY;
                            try {
                                windowManager.updateViewLayout(root, panelLp);
                            } catch (Exception ignored) {}
                            return true;
                        }
                        case MotionEvent.ACTION_UP:
                        case MotionEvent.ACTION_CANCEL:
                            if (dragging && panelLp.y > dm.heightPixels * 0.18f) {
                                hide(app, true);
                            } else {
                                panelLp.y = bottomGap;
                                try {
                                    windowManager.updateViewLayout(root, panelLp);
                                } catch (Exception ignored) {}
                            }
                            return true;
                        default:
                            return false;
                    }
                }
            });

            menuBtn.setOnClickListener(v -> {
                menuSheet.setVisibility(
                    menuSheet.getVisibility() == View.VISIBLE ? View.GONE : View.VISIBLE
                );
            });
            openBtn.setOnClickListener(v -> {
                restoreHeadOnClose = false;
                hide(app, false);
                openInApp(app, peerId, peerName);
            });
            closeBtn.setOnClickListener(v -> hide(app, true));

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
            }, 220);
        } catch (Exception e) {
            Log.e(TAG, "show failed", e);
        }
    }

    private static LinearLayout buildMenuSheet(
        Context app,
        String peerId,
        String peerName,
        boolean bubbleOn,
        String wallpaper
    ) {
        LinearLayout sheet = new LinearLayout(app);
        sheet.setOrientation(LinearLayout.VERTICAL);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(0xF51C1C24);
        bg.setCornerRadius(dp(app, 14));
        bg.setStroke(dp(app, 1), 0x33FFFFFF);
        sheet.setBackground(bg);
        sheet.setPadding(dp(app, 6), dp(app, 8), dp(app, 6), dp(app, 8));
        sheet.setElevation(dp(app, 10));

        addMenuItem(sheet, "Archivos y publicaciones", () -> {
            restoreHeadOnClose = false;
            hide(app, false);
            openInApp(app, peerId, peerName, "shared");
        });
        addMenuItem(sheet, "Ver entrenamientos", () -> {
            restoreHeadOnClose = false;
            hide(app, false);
            openInApp(app, peerId, peerName, "routines");
        });
        addMenuItem(sheet, "Estilo del chat", () -> {
            restoreHeadOnClose = false;
            hide(app, false);
            openInApp(app, peerId, peerName, "wallpaper");
        });
        addMenuItem(sheet, bubbleOn ? "Desactivar burbuja de chat" : "Activar burbuja de chat", () -> {
            ChatBubbleStore.setPeerEnabled(app, peerId, !bubbleOn);
            if (bubbleOn) {
                // turning off — do not restore head
                restoreHeadOnClose = false;
                minimizedPeerId = null;
                toast(app, "Burbuja desactivada");
            } else {
                toast(app, "Burbuja activada");
            }
            sheet.setVisibility(View.GONE);
        });
        addMenuItem(sheet, "Abrir chat completo", () -> {
            restoreHeadOnClose = false;
            hide(app, false);
            openInApp(app, peerId, peerName);
        });
        addMenuItem(sheet, "Bloquear usuario", () -> {
            restoreHeadOnClose = false;
            hide(app, false);
            openInApp(app, peerId, peerName, "block");
        });

        return sheet;
    }

    private static void addMenuItem(LinearLayout sheet, String label, Runnable action) {
        TextView tv = new TextView(sheet.getContext());
        tv.setText(label);
        tv.setTextColor(Color.WHITE);
        tv.setTextSize(14.5f);
        tv.setPadding(dp(sheet.getContext(), 14), dp(sheet.getContext(), 12), dp(sheet.getContext(), 14), dp(sheet.getContext(), 12));
        tv.setClickable(true);
        tv.setOnClickListener(v -> action.run());
        sheet.addView(tv, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
    }

    private static void toast(Context app, String msg) {
        try {
            android.widget.Toast.makeText(app, msg, android.widget.Toast.LENGTH_SHORT).show();
        } catch (Exception ignored) {}
    }

    private static void openInApp(Context context, String peerId, String name) {
        openInApp(context, peerId, name, null);
    }

    private static void openInApp(Context context, String peerId, String name, String action) {
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra("open_path", "/chat");
        open.putExtra("chat_peer_id", peerId);
        open.putExtra("chat_peer_name", name != null ? name : "");
        if (action != null) open.putExtra("chat_action", action);
        context.startActivity(open);
    }

    private static TextView textBtn(Context app, String label) {
        TextView tv = new TextView(app);
        tv.setText(label);
        tv.setTextColor(Color.WHITE);
        tv.setTextSize(20f);
        tv.setPadding(dp(app, 12), dp(app, 8), dp(app, 12), dp(app, 8));
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
            + "*{box-sizing:border-box}html,body{height:100%;margin:0;overflow:hidden}"
            + "body{font-family:system-ui,-apple-system,sans-serif;color:#fff;position:relative;" + wall + "}"
            + "#msgs{padding:12px 14px 76px;overflow-y:auto;height:100%;display:flex;flex-direction:column;gap:8px;-webkit-overflow-scrolling:touch}"
            + ".row{display:flex}.row.me{justify-content:flex-end}.row.them{justify-content:flex-start}"
            + ".b{max-width:82%;padding:9px 13px;border-radius:16px;font-size:15px;line-height:1.35;word-break:break-word}"
            + ".me .b{background:#FF6B35;border-bottom-right-radius:6px}.them .b{background:rgba(255,255,255,.14);border-bottom-left-radius:6px}"
            + "#bar{position:absolute;left:0;right:0;bottom:0;display:flex;gap:8px;padding:10px 12px;padding-bottom:max(10px,env(safe-area-inset-bottom));background:rgba(12,12,16,.96);border-top:1px solid rgba(255,255,255,.08)}"
            + "#inp{flex:1;border:0;border-radius:20px;padding:12px 16px;background:rgba(255,255,255,.1);color:#fff;outline:none;font-size:15px}"
            + "#send{border:0;border-radius:20px;padding:0 18px;background:#FF6B35;color:#fff;font-weight:700;font-size:14px}"
            + ".muted{opacity:.65;font-size:12px;text-align:center;padding:16px}"
            + "</style></head><body>"
            + "<div id=msgs><div class=muted>Cargando chat…</div></div>"
            + "<div id=bar><input id=inp placeholder='Mensaje.' autocomplete=off /><button id=send type=button>Enviar</button></div>"
            + "<script>"
            + "let PEER='',API='',TOKEN='';"
            + "const msgs=document.getElementById('msgs');"
            + "const inp=document.getElementById('inp');"
            + "const sendBtn=document.getElementById('send');"
            + "function esc(s){return String(s||'').replace(/[&<>\"']/g,c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',\"'\":'&#39;' }[c]));}"
            + "function add(m){const me=m.sender==='me';const d=document.createElement('div');d.className='row '+(me?'me':'them');"
            + "d.innerHTML='<div class=b>'+esc(m.text||m.preview||'')+'</div>';msgs.appendChild(d);msgs.scrollTop=msgs.scrollHeight;}"
            + "async function load(){try{const r=await fetch(API+'/chat/messages/'+encodeURIComponent(PEER),{headers:{Authorization:'Bearer '+TOKEN}});"
            + "const data=await r.json();msgs.innerHTML='';(Array.isArray(data)?data:[]).slice(-80).forEach(add);"
            + "if(!msgs.children.length)msgs.innerHTML='<div class=muted>Sin mensajes aún</div>';msgs.scrollTop=msgs.scrollHeight;"
            + "try{QyntraChatPanel.markRead(PEER)}catch(e){}}catch(e){msgs.innerHTML='<div class=muted>No se pudo cargar</div>';}}"
            + "async function send(){const t=(inp.value||'').trim();if(!t)return;inp.value='';add({sender:'me',text:t});"
            + "try{await fetch(API+'/chat/send',{method:'POST',headers:{Authorization:'Bearer '+TOKEN,'Content-Type':'application/json'},"
            + "body:JSON.stringify({to:PEER,content:t})});}catch(e){}}"
            + "sendBtn.onclick=send;inp.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();send()}};"
            + "window.__boot=function(peer,api,token){PEER=peer;API=String(api||'').replace(/\\/$/,'');TOKEN=token||'';load();};"
            + "</script></body></html>";
    }

    public static final class PanelBridge {
        private final Context app;
        private final String peerId;
        private final String peerName;

        PanelBridge(Context app, String peerId, String peerName) {
            this.app = app.getApplicationContext();
            this.peerId = peerId;
            this.peerName = peerName;
        }

        @JavascriptInterface
        public void markRead(String peer) {
            String id = peer != null && !peer.isEmpty() ? peer : peerId;
            ChatBubbleStore.postChatReceipt(app, id, "read");
            ChatBubbleStore.cancelNotification(app, id);
        }

        @JavascriptInterface
        public void close() {
            new Handler(Looper.getMainLooper()).post(() -> ChatPanelOverlay.hide(app, true));
        }

        @JavascriptInterface
        public void openFull() {
            new Handler(Looper.getMainLooper()).post(() -> {
                restoreHeadOnClose = false;
                hide(app, false);
                openInApp(app, peerId, peerName);
            });
        }
    }
}
