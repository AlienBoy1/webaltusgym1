package gym.qyntra.app;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Chronometer;
import android.widget.LinearLayout;
import android.widget.TextView;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

/**
 * Optional FGS + overlay. Must never erase a working shade notification on failure.
 */
public class WorkoutHudService extends Service {
    private static final String TAG = "WorkoutHudService";
    private static final String PREFS = "qyntra_workout_hud";

    public static final String ACTION_START = "gym.qyntra.app.workout.START";
    public static final String ACTION_STOP = "gym.qyntra.app.workout.STOP";

    public static final String EXTRA_TITLE = "title";
    public static final String EXTRA_CONTENT = "content";
    public static final String EXTRA_BIG_TEXT = "bigText";
    public static final String EXTRA_WHEN_MS = "whenMs";
    public static final String EXTRA_COUNT_DOWN = "countDown";
    public static final String EXTRA_SHOW_CHRONO = "showChronometer";
    public static final String EXTRA_BUBBLE_LABEL = "bubbleLabel";
    public static final String EXTRA_IN_REST = "inRest";

    public static final int NOTIF_ID = WorkoutHudNotifier.NOTIF_ID;

    private WindowManager windowManager;
    private View overlayView;
    private Chronometer overlayChrono;
    private TextView overlaySubtitle;

    public static void startOrUpdate(Context context, Intent extrasSource) {
        Intent intent = new Intent(context, WorkoutHudService.class);
        intent.setAction(ACTION_START);
        if (extrasSource != null && extrasSource.getExtras() != null) {
            intent.putExtras(extrasSource.getExtras());
        }
        ContextCompat.startForegroundService(context, intent);
    }

    public static void stop(Context context) {
        Intent intent = new Intent(context, WorkoutHudService.class);
        intent.setAction(ACTION_STOP);
        try {
            context.startService(intent);
        } catch (Exception e) {
            try {
                context.stopService(new Intent(context, WorkoutHudService.class));
            } catch (Exception ignored) {
                /* ignore */
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && ACTION_STOP.equals(intent.getAction())) {
            removeOverlay();
            try {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } catch (Exception ignored) {
                /* ignore */
            }
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification notification = WorkoutHudNotifier.buildFromIntent(this, intent);
        boolean fgsOk = promoteToForeground(notification);
        if (!fgsOk) {
            // Keep shade notification; stop this service cleanly without REMOVE wiping it.
            WorkoutHudNotifier.notifyNow(this, notification);
            try {
                stopForeground(STOP_FOREGROUND_DETACH);
            } catch (Exception ignored) {
                /* ignore */
            }
            stopSelf();
            return START_NOT_STICKY;
        }

        if (intent != null) {
            long whenMs = intent.getLongExtra(EXTRA_WHEN_MS, System.currentTimeMillis());
            boolean countDown = intent.getBooleanExtra(EXTRA_COUNT_DOWN, false);
            String bubble = intent.getStringExtra(EXTRA_BUBBLE_LABEL);
            if (bubble == null || bubble.isEmpty()) {
                bubble = intent.getStringExtra(EXTRA_CONTENT);
            }
            if (bubble == null) bubble = "Entreno";
            maybeShowOverlay(bubble, whenMs, countDown);
        }

        return START_STICKY;
    }

    private boolean promoteToForeground(Notification notification) {
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                ServiceCompat.startForeground(
                    this,
                    NOTIF_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                );
            } else {
                startForeground(NOTIF_ID, notification);
            }
            Log.i(TAG, "startForeground ok");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "startForeground failed", e);
            try {
                startForeground(NOTIF_ID, notification);
                return true;
            } catch (Exception e2) {
                Log.e(TAG, "startForeground fallback failed", e2);
                return false;
            }
        }
    }

    @Override
    public void onDestroy() {
        removeOverlay();
        // If workout still active, detach so shade notification survives service death
        try {
            SharedPreferences sp = getSharedPreferences(PREFS, MODE_PRIVATE);
            if (sp.getBoolean("active", false)) {
                stopForeground(STOP_FOREGROUND_DETACH);
            }
        } catch (Exception ignored) {
            /* ignore */
        }
        super.onDestroy();
    }

    private long chronoBase(long whenMs, boolean countDown) {
        long now = System.currentTimeMillis();
        if (countDown) {
            long remaining = Math.max(0L, whenMs - now);
            return SystemClock.elapsedRealtime() + remaining;
        }
        long elapsed = Math.max(0L, now - whenMs);
        return SystemClock.elapsedRealtime() - elapsed;
    }

    private void maybeShowOverlay(String label, long whenMs, boolean countDown) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(this)) {
            removeOverlay();
            return;
        }
        try {
            if (overlayView == null) {
                windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);

                LinearLayout root = new LinearLayout(this);
                root.setOrientation(LinearLayout.VERTICAL);
                root.setBackgroundColor(0xF0111118);
                root.setPadding(dp(14), dp(10), dp(14), dp(10));
                root.setElevation(dp(10));
                root.setMinimumWidth(dp(96));

                overlayChrono = new Chronometer(this);
                overlayChrono.setTextColor(0xFFFF8A3D);
                overlayChrono.setTextSize(18f);
                overlayChrono.setTypeface(Typeface.DEFAULT_BOLD);
                overlayChrono.setFormat("%s");
                root.addView(overlayChrono);

                overlaySubtitle = new TextView(this);
                overlaySubtitle.setTextColor(0xCCFFFFFF);
                overlaySubtitle.setTextSize(11f);
                overlaySubtitle.setMaxLines(1);
                overlaySubtitle.setPadding(0, dp(2), 0, 0);
                root.addView(overlaySubtitle);

                root.setOnClickListener(v -> {
                    Intent open = new Intent(this, MainActivity.class);
                    open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    open.putExtra("open_path", "/workouts");
                    startActivity(open);
                });

                int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE;

                WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    type,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                        | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                    PixelFormat.TRANSLUCENT
                );
                params.gravity = Gravity.TOP | Gravity.END;
                params.x = dp(12);
                params.y = dp(96);

                windowManager.addView(root, params);
                overlayView = root;
            }

            if (overlaySubtitle != null) {
                overlaySubtitle.setText(label != null ? label : "Entreno");
            }
            if (overlayChrono != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    overlayChrono.setCountDown(countDown);
                }
                overlayChrono.setBase(chronoBase(whenMs, countDown));
                overlayChrono.start();
            }
        } catch (Exception e) {
            Log.e(TAG, "overlay failed", e);
            removeOverlay();
        }
    }

    private void removeOverlay() {
        try {
            if (overlayChrono != null) overlayChrono.stop();
            if (windowManager != null && overlayView != null) {
                windowManager.removeView(overlayView);
            }
        } catch (Exception ignored) {
            /* already gone */
        }
        overlayView = null;
        overlayChrono = null;
        overlaySubtitle = null;
    }

    private int dp(int value) {
        float d = getResources().getDisplayMetrics().density;
        return Math.round(value * d);
    }
}
