package gym.qyntra.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final String PREFS = "qyntra_workout_hud";
    private static volatile boolean inForeground = false;

    public static boolean isInForeground() {
        return inForeground;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkoutHudPlugin.class);
        super.onCreate(savedInstanceState);
        createDefaultNotificationChannel();
        injectNativeBridge();
        handleWorkoutOpenIntent(getIntent());
    }

    @Override
    public void onResume() {
        super.onResume();
        inForeground = true;
        injectNativeBridge();
        // Inside the app: ALWAYS hide system overlays (React UI owns the foreground)
        WorkoutHudOverlay.hideForForeground(this);
        ChatBubbleOverlay.hideAll(this);
        ChatPanelOverlay.hide(this);
        WorkoutHudPlugin.restoreIfNeeded(this);
        getWindow().getDecorView().post(() -> WorkoutHudOverlay.hideForForeground(this));
        getWindow().getDecorView().postDelayed(() -> WorkoutHudOverlay.hideForForeground(this), 400);
    }

    @Override
    public void onPause() {
        inForeground = false;
        // Leaving the app: show the "entrenando" system bubble if workout is active
        try {
            SharedPreferences sp = getSharedPreferences(PREFS, MODE_PRIVATE);
            if (sp.getBoolean("active", false) && WorkoutHudOverlay.canDraw(this)) {
                WorkoutHudOverlay.showForBackground(
                    this,
                    "entrenando",
                    sp.getLong("whenMs", System.currentTimeMillis()),
                    sp.getBoolean("countDown", false)
                );
                WorkoutHudOverlay.updateCached(
                    "entrenando",
                    sp.getLong("whenMs", System.currentTimeMillis()),
                    sp.getBoolean("countDown", false),
                    sp.getFloat("progress", 0.08f)
                );
            }
        } catch (Exception e) {
            Log.e(TAG, "onPause overlay failed", e);
        }
        super.onPause();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleWorkoutOpenIntent(intent);
    }

    private void injectNativeBridge() {
        try {
            if (getBridge() == null || getBridge().getWebView() == null) {
                getWindow().getDecorView().postDelayed(this::injectNativeBridge, 300);
                return;
            }
            WebView webView = getBridge().getWebView();
            webView.addJavascriptInterface(new WorkoutHudBridge(this), "QyntraNative");
            Log.i(TAG, "QyntraNative bridge injected");
        } catch (Exception e) {
            Log.e(TAG, "injectNativeBridge failed", e);
        }
    }

    private void handleWorkoutOpenIntent(Intent intent) {
        if (intent == null) return;
        String path = intent.getStringExtra("open_path");
        String action = intent.getStringExtra("workout_action");
        String chatPeerId = intent.getStringExtra("chat_peer_id");
        String chatPeerName = intent.getStringExtra("chat_peer_name");
        if ((path == null || path.isEmpty())
            && (action == null || action.isEmpty())
            && (chatPeerId == null || chatPeerId.isEmpty())) {
            return;
        }
        final String target = (path == null || path.isEmpty())
            ? (chatPeerId != null && !chatPeerId.isEmpty() ? "/chat" : "/workouts")
            : (path.startsWith("/") ? path : "/" + path);
        final String act = action != null ? action : "open";
        final String peer = chatPeerId != null ? chatPeerId.replace("'", "") : "";
        final String peerName = chatPeerName != null
            ? chatPeerName.replace("\\", "\\\\").replace("'", "\\'")
            : "";
        if (!peer.isEmpty()) {
            ChatBubbleStore.cancelNotification(this, peer);
            ChatBubbleOverlay.hide(this, peer);
            ChatBubbleStore.postChatReceipt(this, peer, "read");
        }
        getWindow().getDecorView().postDelayed(() -> {
            try {
                if (getBridge() == null || getBridge().getWebView() == null) return;
                // Prefer React Router via CustomEvent — avoid window.location.assign (blank WebView)
                String js =
                    "(function(){try{" +
                    "window.dispatchEvent(new CustomEvent('qyntra:native-open',{detail:{path:'" + target + "',action:'" + act + "',chatPeerId:'" + peer + "',chatPeerName:'" + peerName + "'}}));" +
                    "window.dispatchEvent(new CustomEvent('qyntra:workout-action',{detail:{action:'" + act + "'}}));" +
                    "}catch(e){}})();";
                getBridge().getWebView().evaluateJavascript(js, null);
            } catch (Exception ignored) {
                /* bridge not ready */
            }
        }, 400);
    }

    private void createDefaultNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager == null) return;

        NotificationChannel defaults = new NotificationChannel(
            "qyntra_default",
            "Qyntra",
            NotificationManager.IMPORTANCE_HIGH
        );
        defaults.setDescription("Notificaciones de Qyntra Gym");
        manager.createNotificationChannel(defaults);

        NotificationChannel workout = new NotificationChannel(
            WorkoutHudNotifier.CHANNEL_ID,
            "Entreno en vivo",
            NotificationManager.IMPORTANCE_HIGH
        );
        workout.setDescription("Temporizador de entrenamiento");
        workout.setShowBadge(true);
        workout.enableVibration(false);
        workout.setSound(null, null);
        workout.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        manager.createNotificationChannel(workout);

        ChatBubbleStore.ensureChannel(this);
    }
}
