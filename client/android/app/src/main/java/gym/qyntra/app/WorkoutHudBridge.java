package gym.qyntra.app;

import android.app.Activity;
import android.app.Notification;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.webkit.JavascriptInterface;
import androidx.core.app.ActivityCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

/**
 * Direct WebView bridge — bypasses Capacitor plugin dispatch.
 * JS: window.QyntraNative.showWorkout(...)
 */
public final class WorkoutHudBridge {
    private static final String TAG = "WorkoutHudBridge";
    private static final String PREFS = "qyntra_workout_hud";
    private static final int REQ_POST = 77001;

    private final Activity activity;

    public WorkoutHudBridge(Activity activity) {
        this.activity = activity;
    }

    private boolean notificationsAllowed() {
        if (!NotificationManagerCompat.from(activity).areNotificationsEnabled()) {
            return false;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(
            activity,
            android.Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED;
    }

    @JavascriptInterface
    public String checkStatus() {
        int active = WorkoutHudNotifier.countActive(activity);
        boolean notif = notificationsAllowed();
        boolean overlay = WorkoutHudOverlay.canDraw(activity);
        return "{\"notifications\":\"" + (notif ? "granted" : "denied") +
            "\",\"overlay\":\"" + (overlay ? "granted" : "denied") +
            "\",\"activeCount\":" + active +
            ",\"channelId\":\"" + WorkoutHudNotifier.CHANNEL_ID + "\"}";
    }

    @JavascriptInterface
    public void requestNotificationPermission() {
        activity.runOnUiThread(() -> {
            if (notificationsAllowed()) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                ActivityCompat.requestPermissions(
                    activity,
                    new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
                    REQ_POST
                );
            }
        });
    }

    /**
     * Publish ongoing workout notification + optional overlay.
     * Returns JSON string with ok/activeCount/error.
     */
    @JavascriptInterface
    public String showWorkout(
        String title,
        String content,
        String bubbleLabel,
        boolean countDown,
        double whenMs,
        double progress
    ) {
        final String t = (title == null || title.isEmpty()) ? "Entrenamiento en vivo" : title;
        final String c = (content == null || content.isEmpty()) ? "Sesión activa" : content;
        final String bubble = (bubbleLabel == null || bubbleLabel.isEmpty()) ? "entrenando" : bubbleLabel;
        final long when = whenMs > 0 ? (long) whenMs : System.currentTimeMillis();
        final float prog = (float) Math.max(0, Math.min(1, progress));

        final String[] resultHolder = new String[]{"{\"ok\":false,\"error\":\"pending\"}"};
        final Object lock = new Object();

        activity.runOnUiThread(() -> {
            try {
                if (!notificationsAllowed()) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        ActivityCompat.requestPermissions(
                            activity,
                            new String[]{android.Manifest.permission.POST_NOTIFICATIONS},
                            REQ_POST
                        );
                    }
                    synchronized (lock) {
                        resultHolder[0] = "{\"ok\":false,\"error\":\"permission\",\"notifications\":\"denied\"}";
                        lock.notifyAll();
                    }
                    return;
                }

                Intent extras = new Intent();
                extras.putExtra(WorkoutHudService.EXTRA_TITLE, t);
                extras.putExtra(WorkoutHudService.EXTRA_CONTENT, c);
                extras.putExtra(WorkoutHudService.EXTRA_BIG_TEXT, c);
                extras.putExtra(WorkoutHudService.EXTRA_BUBBLE_LABEL, bubble);
                extras.putExtra(WorkoutHudService.EXTRA_SHOW_CHRONO, true);
                extras.putExtra(WorkoutHudService.EXTRA_COUNT_DOWN, countDown);
                extras.putExtra(WorkoutHudService.EXTRA_IN_REST, countDown);
                extras.putExtra(WorkoutHudService.EXTRA_WHEN_MS, when);

                Notification notification = WorkoutHudNotifier.buildFromIntent(activity, extras);
                boolean posted = WorkoutHudNotifier.notifyNow(activity, notification);
                int active = WorkoutHudNotifier.countActive(activity);

                SharedPreferences.Editor ed = activity
                    .getSharedPreferences(PREFS, Activity.MODE_PRIVATE)
                    .edit();
                ed.putBoolean("active", true);
                ed.putString("title", t);
                ed.putString("content", c);
                ed.putString("bigText", c);
                ed.putString("bubbleLabel", bubble);
                ed.putBoolean("showChronometer", true);
                ed.putBoolean("countDown", countDown);
                ed.putBoolean("inRest", countDown);
                ed.putLong("whenMs", when);
                ed.putFloat("progress", prog);
                ed.apply();

                WorkoutHudOverlay.updateCached(bubble, when, countDown, prog);

                Log.i(TAG, "showWorkout posted=" + posted + " active=" + active);

                synchronized (lock) {
                    resultHolder[0] =
                        "{\"ok\":" + (posted || active > 0 || active < 0) +
                        ",\"posted\":" + posted +
                        ",\"activeCount\":" + active +
                        ",\"notifications\":\"granted\"" +
                        ",\"overlay\":\"" + (WorkoutHudOverlay.canDraw(activity) ? "granted" : "denied") + "\"}";
                    lock.notifyAll();
                }
            } catch (Exception e) {
                Log.e(TAG, "showWorkout failed", e);
                synchronized (lock) {
                    resultHolder[0] = "{\"ok\":false,\"error\":\"" + String.valueOf(e.getMessage()).replace("\"", "'") + "\"}";
                    lock.notifyAll();
                }
            }
        });

        try {
            synchronized (lock) {
                lock.wait(2500);
            }
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
        return resultHolder[0];
    }

    @JavascriptInterface
    public void clearWorkout() {
        activity.runOnUiThread(() -> {
            try {
                activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE)
                    .edit()
                    .putBoolean("active", false)
                    .apply();
                WorkoutHudOverlay.remove(activity);
                WorkoutHudNotifier.cancel(activity);
            } catch (Exception e) {
                Log.e(TAG, "clearWorkout failed", e);
            }
        });
    }

    @JavascriptInterface
    public void hideOverlay() {
        activity.runOnUiThread(() -> {
            try {
                WorkoutHudOverlay.hideForForeground(activity);
            } catch (Exception e) {
                Log.e(TAG, "hideOverlay failed", e);
            }
        });
    }

    /**
     * Never draw the system bubble while the Activity is in the foreground.
     * In-app UX uses the React bubble; the system overlay only appears on onPause.
     */
    @JavascriptInterface
    public void forceShowOverlay() {
        activity.runOnUiThread(() -> {
            try {
                SharedPreferences sp = activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
                if (!sp.getBoolean("active", false)) return;
                // Keep cache warm so onPause can show immediately, but stay hidden in-app.
                WorkoutHudOverlay.updateCached(
                    "entrenando",
                    sp.getLong("whenMs", System.currentTimeMillis()),
                    sp.getBoolean("countDown", false),
                    sp.getFloat("progress", 0.08f)
                );
                WorkoutHudOverlay.hideForForeground(activity);
            } catch (Exception e) {
                Log.e(TAG, "forceShowOverlay failed", e);
            }
        });
    }

    @JavascriptInterface
    public void startOverlay() {
        activity.runOnUiThread(() -> {
            try {
                SharedPreferences sp = activity.getSharedPreferences(PREFS, Activity.MODE_PRIVATE);
                if (!sp.getBoolean("active", false)) return;
                WorkoutHudOverlay.updateCached(
                    "entrenando",
                    sp.getLong("whenMs", System.currentTimeMillis()),
                    sp.getBoolean("countDown", false)
                );
                // Only draw if already in background mode (visibleForBackground)
                WorkoutHudOverlay.show(
                    activity,
                    "entrenando",
                    sp.getLong("whenMs", System.currentTimeMillis()),
                    sp.getBoolean("countDown", false)
                );
            } catch (Exception e) {
                Log.e(TAG, "startOverlay failed", e);
            }
        });
    }

    @JavascriptInterface
    public void openOverlaySettings() {
        activity.runOnUiThread(() -> {
            try {
                Intent intent = new Intent(
                    android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    android.net.Uri.parse("package:" + activity.getPackageName())
                );
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
            } catch (Exception e) {
                Log.e(TAG, "openOverlaySettings failed", e);
            }
        });
    }

    @JavascriptInterface
    public void openNotificationSettings() {
        activity.runOnUiThread(() -> {
            try {
                Intent intent = new Intent();
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    intent.setAction(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                    intent.putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, activity.getPackageName());
                } else {
                    intent.setAction(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                    intent.setData(android.net.Uri.parse("package:" + activity.getPackageName()));
                }
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
            } catch (Exception e) {
                Log.e(TAG, "openNotificationSettings failed", e);
            }
        });
    }

    @JavascriptInterface
    public void syncChatBubbles(String json) {
        try {
            ChatBubbleStore.syncFromJson(activity, json);
        } catch (Exception e) {
            Log.e(TAG, "syncChatBubbles failed", e);
        }
    }

    @JavascriptInterface
    public String showChatBubble(String peerId, String name, String preview, String avatarUrl) {
        // Preference-only enable must never draw while the user is inside the app.
        if (MainActivity.isInForeground()) {
            return "{\"ok\":true,\"deferred\":true}";
        }
        final String[] out = new String[]{"{\"ok\":false}"};
        final Object lock = new Object();
        activity.runOnUiThread(() -> {
            try {
                if (!ChatBubbleOverlay.canDraw(activity)) {
                    out[0] = "{\"ok\":false,\"error\":\"overlay\"}";
                } else {
                    ChatBubbleOverlay.show(activity, peerId, name, preview, 1);
                    out[0] = "{\"ok\":true}";
                }
            } catch (Exception e) {
                out[0] = "{\"ok\":false,\"error\":\"" + String.valueOf(e.getMessage()).replace("\"", "'") + "\"}";
            }
            synchronized (lock) {
                lock.notifyAll();
            }
        });
        try {
            synchronized (lock) {
                lock.wait(1200);
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        return out[0];
    }

    @JavascriptInterface
    public void hideChatBubble(String peerId) {
        activity.runOnUiThread(() -> {
            try {
                if (peerId == null || peerId.isEmpty()) ChatBubbleOverlay.hideAll(activity);
                else ChatBubbleOverlay.hide(activity, peerId);
            } catch (Exception e) {
                Log.e(TAG, "hideChatBubble failed", e);
            }
        });
    }

    @JavascriptInterface
    public void cancelChatNotification(String peerId) {
        try {
            ChatBubbleStore.cancelNotification(activity, peerId);
            ChatBubbleOverlay.hide(activity, peerId);
        } catch (Exception e) {
            Log.e(TAG, "cancelChatNotification failed", e);
        }
    }
}
