package gym.qyntra.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.Log;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** SharedPreferences + notifications for Messenger-style chat heads. */
public final class ChatBubbleStore {
    private static final String TAG = "ChatBubbleStore";
    public static final String PREFS = "qyntra_chat_bubbles";
    public static final String CHANNEL_ID = "qyntra_chat_messages";
    private static final String KEY_PEERS = "enabled_peers";
    private static final String KEY_API = "api_base";
    private static final String KEY_TOKEN = "auth_token";
    private static final String KEY_META = "peers_meta_json";
    private static final int NOTIF_BASE = 88000;

    public static final class PeerMeta {
        public String name = "";
        public String avatar = "";
        public String wallpaper = "none";
    }

    private ChatBubbleStore() {}

    public static void syncFromJson(Context context, String json) {
        try {
            JSONObject obj = new JSONObject(json == null ? "{}" : json);
            SharedPreferences.Editor ed = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
            if (obj.has("apiBase")) {
                ed.putString(KEY_API, obj.optString("apiBase", ""));
            }
            if (obj.has("authToken")) {
                String tok = obj.optString("authToken", "");
                if (tok != null && !tok.isEmpty()) ed.putString(KEY_TOKEN, tok);
            }
            if (obj.has("peersMeta")) {
                ed.putString(KEY_META, obj.optJSONObject("peersMeta") != null
                    ? obj.optJSONObject("peersMeta").toString()
                    : obj.optString("peersMeta", "{}"));
            }
            JSONArray peers = obj.optJSONArray("peers");
            Set<String> set = new HashSet<>();
            StringBuilder csv = new StringBuilder();
            if (peers != null) {
                for (int i = 0; i < peers.length(); i++) {
                    String id = peers.optString(i, "");
                    if (id.isEmpty()) continue;
                    set.add(id);
                    if (csv.length() > 0) csv.append(',');
                    csv.append(id);
                }
            }
            ed.putStringSet(KEY_PEERS, new HashSet<>(set));
            ed.putString(KEY_PEERS + "_csv", csv.toString());
            ed.commit();
        } catch (Exception e) {
            Log.e(TAG, "syncFromJson", e);
        }
    }

    public static PeerMeta peerMeta(Context context, String peerId) {
        PeerMeta out = new PeerMeta();
        if (peerId == null || peerId.isEmpty()) return out;
        try {
            String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_META, "{}");
            JSONObject all = new JSONObject(raw == null || raw.isEmpty() ? "{}" : raw);
            JSONObject hit = all.optJSONObject(peerId);
            if (hit == null) return out;
            out.name = hit.optString("name", "");
            out.avatar = hit.optString("avatar", "");
            out.wallpaper = hit.optString("wallpaper", "none");
        } catch (Exception e) {
            Log.w(TAG, "peerMeta", e);
        }
        return out;
    }

    public static String resolveDisplayName(Context context, String peerId, String fallback) {
        PeerMeta meta = peerMeta(context, peerId);
        if (meta.name != null && !meta.name.isEmpty() && !"Usuario".equalsIgnoreCase(meta.name)) {
            return meta.name;
        }
        if (fallback != null && !fallback.isEmpty() && !"Usuario".equalsIgnoreCase(fallback)) {
            return fallback;
        }
        return fallback != null && !fallback.isEmpty() ? fallback : "Nuevo mensaje";
    }

    public static boolean isEnabled(Context context, String peerId) {
        if (peerId == null || peerId.isEmpty()) return false;
        SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Set<String> set = sp.getStringSet(KEY_PEERS, null);
        if (set != null && set.contains(peerId)) return true;
        String csv = sp.getString(KEY_PEERS + "_csv", "");
        if (csv == null || csv.isEmpty()) return false;
        for (String part : csv.split(",")) {
            if (peerId.equals(part.trim())) return true;
        }
        return false;
    }

    /** Enable/disable a single peer bubble from the floating panel menu. */
    public static void setPeerEnabled(Context context, String peerId, boolean enabled) {
        if (peerId == null || peerId.isEmpty()) return;
        SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        Set<String> set = new HashSet<>();
        Set<String> prev = sp.getStringSet(KEY_PEERS, null);
        if (prev != null) set.addAll(prev);
        String csv = sp.getString(KEY_PEERS + "_csv", "");
        if (csv != null && !csv.isEmpty()) {
            for (String part : csv.split(",")) {
                String p = part.trim();
                if (!p.isEmpty()) set.add(p);
            }
        }
        if (enabled) set.add(peerId);
        else set.remove(peerId);
        StringBuilder out = new StringBuilder();
        for (String id : set) {
            if (out.length() > 0) out.append(',');
            out.append(id);
        }
        SharedPreferences.Editor ed = sp.edit();
        ed.putStringSet(KEY_PEERS, new HashSet<>(set));
        ed.putString(KEY_PEERS + "_csv", out.toString());
        ed.commit();
        if (!enabled) {
            cancelNotification(context, peerId);
            ChatBubbleOverlay.hide(context, peerId);
        }
    }

    public static String apiBase(Context context) {
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_API, "");
    }

    public static String authToken(Context context) {
        SharedPreferences sp = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String direct = sp.getString(KEY_TOKEN, null);
        if (direct != null && !direct.isEmpty()) return direct;
        // Capacitor Preferences storage
        SharedPreferences cap = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String token = cap.getString("qyntra.auth.token", null);
        if (token != null && !token.isEmpty()) return token;
        return null;
    }

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(
            CHANNEL_ID,
            "Mensajes",
            NotificationManager.IMPORTANCE_HIGH
        );
        ch.setDescription("Mensajes de chat de Qyntra");
        nm.createNotificationChannel(ch);
    }

    public static int notifIdForPeer(String peerId) {
        return NOTIF_BASE + Math.abs((peerId == null ? "" : peerId).hashCode() % 100000);
    }

    public static void showMessageNotification(
        Context context,
        String peerId,
        String title,
        String body
    ) {
        ensureChannel(context);
        String displayTitle = resolveDisplayName(context, peerId, title);
        Intent open = new Intent(context, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra("open_path", "/chat");
        open.putExtra("chat_peer_id", peerId);
        open.putExtra("chat_peer_name", displayTitle);

        PendingIntent openPi = PendingIntent.getActivity(
            context,
            notifIdForPeer(peerId),
            open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Intent mark = new Intent(context, ChatBubbleActionReceiver.class);
        mark.setAction(ChatBubbleActionReceiver.ACTION_MARK_READ);
        mark.putExtra("peer_id", peerId);
        PendingIntent markPi = PendingIntent.getBroadcast(
            context,
            notifIdForPeer(peerId) + 1,
            mark,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_qyntra_q)
            .setContentTitle(displayTitle)
            .setContentText(body != null ? body : "")
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body != null ? body : ""))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(openPi)
            .addAction(0, "Abrir", openPi)
            .addAction(0, "Marcar como leído", markPi);

        try {
            NotificationManagerCompat.from(context).notify(notifIdForPeer(peerId), builder.build());
        } catch (Exception e) {
            Log.e(TAG, "notify failed", e);
        }
    }

    public static void cancelNotification(Context context, String peerId) {
        try {
            NotificationManagerCompat.from(context).cancel(notifIdForPeer(peerId));
        } catch (Exception ignored) {}
    }

    /** Mark messages delivered/read via REST using stored JWT. */
    public static void postChatReceipt(Context context, String peerId, String mode) {
        new Thread(() -> {
            try {
                String base = apiBase(context);
                String token = authToken(context);
                if (base == null || base.isEmpty() || token == null || peerId == null) return;
                String path = "delivered".equals(mode)
                    ? "/chat/delivered/" + peerId
                    : "/chat/read/" + peerId;
                URL url = new URL(base.replaceAll("/$", "") + path);
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Authorization", "Bearer " + token);
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setConnectTimeout(12000);
                conn.setReadTimeout(12000);
                conn.setDoOutput(true);
                byte[] body = "{}".getBytes(StandardCharsets.UTF_8);
                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body);
                }
                int code = conn.getResponseCode();
                Log.i(TAG, "postChatReceipt " + mode + " code=" + code);
                conn.disconnect();
            } catch (Exception e) {
                Log.e(TAG, "postChatReceipt failed", e);
            }
        }).start();
    }
}
