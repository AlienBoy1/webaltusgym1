package gym.qyntra.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.os.Build;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Chronometer;
import android.widget.LinearLayout;
import android.widget.TextView;

/**
 * System overlay bubble (SYSTEM_ALERT_WINDOW).
 * Lives outside the WebView — survives minimize without a Foreground Service.
 */
public final class WorkoutHudOverlay {
    private static final String TAG = "WorkoutHudOverlay";

    private static WindowManager windowManager;
    private static View overlayView;
    private static Chronometer overlayChrono;
    private static TextView overlaySubtitle;

    private WorkoutHudOverlay() {}

    public static boolean canDraw(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context);
    }

    public static void show(Context context, String label, long whenMs, boolean countDown) {
        if (!canDraw(context)) {
            remove(context);
            return;
        }
        try {
            Context app = context.getApplicationContext();
            if (windowManager == null) {
                windowManager = (WindowManager) app.getSystemService(Context.WINDOW_SERVICE);
            }
            if (windowManager == null) return;

            if (overlayView == null) {
                LinearLayout root = new LinearLayout(app);
                root.setOrientation(LinearLayout.VERTICAL);
                root.setBackgroundColor(0xF0111118);
                root.setPadding(dp(app, 14), dp(app, 10), dp(app, 14), dp(app, 10));
                root.setElevation(dp(app, 10));
                root.setMinimumWidth(dp(app, 110));

                overlayChrono = new Chronometer(app);
                overlayChrono.setTextColor(0xFFFF8A3D);
                overlayChrono.setTextSize(18f);
                overlayChrono.setTypeface(Typeface.DEFAULT_BOLD);
                overlayChrono.setFormat("%s");
                root.addView(overlayChrono);

                overlaySubtitle = new TextView(app);
                overlaySubtitle.setTextColor(0xCCFFFFFF);
                overlaySubtitle.setTextSize(11f);
                overlaySubtitle.setMaxLines(1);
                overlaySubtitle.setPadding(0, dp(app, 2), 0, 0);
                root.addView(overlaySubtitle);

                root.setOnClickListener(v -> {
                    Intent open = new Intent(app, MainActivity.class);
                    open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    open.putExtra("open_path", "/workouts");
                    app.startActivity(open);
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
                params.x = dp(app, 12);
                params.y = dp(app, 96);

                windowManager.addView(root, params);
                overlayView = root;
                Log.i(TAG, "overlay added");
            }

            if (overlaySubtitle != null) {
                overlaySubtitle.setText(label != null && !label.isEmpty() ? label : "Entrenando");
            }
            if (overlayChrono != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    overlayChrono.setCountDown(countDown);
                }
                overlayChrono.setBase(chronoBase(whenMs, countDown));
                overlayChrono.start();
            }
        } catch (Exception e) {
            Log.e(TAG, "show overlay failed", e);
            remove(context);
        }
    }

    public static void remove(Context context) {
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

    private static long chronoBase(long whenMs, boolean countDown) {
        long now = System.currentTimeMillis();
        if (countDown) {
            long remaining = Math.max(0L, whenMs - now);
            return SystemClock.elapsedRealtime() + remaining;
        }
        long elapsed = Math.max(0L, now - whenMs);
        return SystemClock.elapsedRealtime() - elapsed;
    }

    private static int dp(Context context, int value) {
        float d = context.getResources().getDisplayMetrics().density;
        return Math.round(value * d);
    }
}
