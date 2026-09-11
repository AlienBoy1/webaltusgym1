package gym.qyntra.app;

import android.content.Context;
import android.content.Intent;
import android.graphics.PixelFormat;
import android.os.Build;
import android.provider.Settings;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;

/**
 * System overlay bubble matching the in-app "entrenando" floating panel.
 * Shown only while the app is in the background.
 */
public final class WorkoutHudOverlay {
    private static final String TAG = "WorkoutHudOverlay";

    private static WindowManager windowManager;
    private static View overlayView;
    private static WorkoutBubbleView bubbleView;
    private static WindowManager.LayoutParams layoutParams;
    private static android.os.Handler tickHandler;
    private static Runnable tickRunnable;
    private static long whenMsCached;
    private static boolean countDownCached;
    private static float progressCached;
    private static boolean visibleForBackground;

    private WorkoutHudOverlay() {}

    public static boolean canDraw(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context);
    }

    public static void showPreview(Context context, long whenMs, boolean countDown, float progress) {
        // Preview is disabled while the app is foregrounded — callers must not draw a second bubble.
        // Warm cache only; real show happens via showForBackground from MainActivity.onPause.
        whenMsCached = whenMs > 0 ? whenMs : getCachedWhenMs();
        countDownCached = countDown;
        progressCached = progress > 0 ? progress : Math.max(0.08f, progressCached);
        hideForForeground(context);
    }

    /** App went to background: show the entrenando bubble if overlay permission is granted. */
    public static void showForBackground(Context context, String label, long whenMs, boolean countDown) {
        visibleForBackground = true;
        showInternal(context, whenMs > 0 ? whenMs : getCachedWhenMs(), countDown, Math.max(0.08f, progressCached));
    }

    public static void hideForForeground(Context context) {
        visibleForBackground = false;
        remove(context);
    }

    public static void show(Context context, String label, long whenMs, boolean countDown) {
        if (!visibleForBackground) {
            whenMsCached = whenMs;
            countDownCached = countDown;
            return;
        }
        showInternal(context, whenMs, countDown, progressCached);
    }

    public static void updateCached(String label, long whenMs, boolean countDown) {
        updateCached(label, whenMs, countDown, progressCached);
    }

    public static void updateCached(String label, long whenMs, boolean countDown, float progress) {
        whenMsCached = whenMs > 0 ? whenMs : System.currentTimeMillis();
        countDownCached = countDown;
        progressCached = Math.max(0f, Math.min(1f, progress));
        if (visibleForBackground && bubbleView != null) {
            refreshChronoText();
            bubbleView.setProgress(progressCached);
        }
    }

    public static long getCachedWhenMs() {
        return whenMsCached > 0 ? whenMsCached : System.currentTimeMillis();
    }

    public static boolean getCachedCountDown() {
        return countDownCached;
    }

    private static void showInternal(Context context, long whenMs, boolean countDown, float progress) {
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

            whenMsCached = whenMs > 0 ? whenMs : System.currentTimeMillis();
            countDownCached = countDown;
            progressCached = Math.max(0f, Math.min(1f, progress));

            if (overlayView != null && overlayView.getParent() != null && bubbleView != null) {
                refreshChronoText();
                bubbleView.setProgress(progressCached);
                return;
            }

            forceDetach(app);

            int size = dp(app, 96);
            bubbleView = new WorkoutBubbleView(app);
            bubbleView.setClickable(true);
            bubbleView.setFocusable(true);
            bubbleView.setProgress(progressCached <= 0f ? 0.08f : progressCached);

            bubbleView.setOnClickListener(v -> {
                Intent open = new Intent(app, MainActivity.class);
                open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                open.putExtra("open_path", "/workouts");
                app.startActivity(open);
            });

            bubbleView.setOnTouchListener(new View.OnTouchListener() {
                private int startX;
                private int startY;
                private float touchX;
                private float touchY;
                private boolean moved;

                @Override
                public boolean onTouch(View v, MotionEvent event) {
                    if (layoutParams == null || windowManager == null) return false;
                    switch (event.getAction()) {
                        case MotionEvent.ACTION_DOWN:
                            startX = layoutParams.x;
                            startY = layoutParams.y;
                            touchX = event.getRawX();
                            touchY = event.getRawY();
                            moved = false;
                            return true;
                        case MotionEvent.ACTION_MOVE:
                            int dx = Math.round(event.getRawX() - touchX);
                            int dy = Math.round(event.getRawY() - touchY);
                            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
                            layoutParams.x = Math.max(0, startX - dx);
                            layoutParams.y = Math.max(0, startY + dy);
                            try {
                                windowManager.updateViewLayout(overlayView, layoutParams);
                            } catch (Exception ignored) {
                                /* ignore */
                            }
                            return true;
                        case MotionEvent.ACTION_UP:
                            if (!moved) v.performClick();
                            return true;
                        default:
                            return false;
                    }
                }
            });

            int type = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE;

            layoutParams = new WindowManager.LayoutParams(
                size,
                size,
                type,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                    | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
                PixelFormat.TRANSLUCENT
            );
            // Blur content behind the bubble (Android 12+) — glass feel like in-app bubble
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try {
                    layoutParams.flags |= WindowManager.LayoutParams.FLAG_BLUR_BEHIND;
                    layoutParams.setBlurBehindRadius(48);
                } catch (Exception ignored) {
                    /* OEM may block blur-behind on overlays */
                }
            }
            layoutParams.gravity = Gravity.TOP | Gravity.END;
            layoutParams.x = dp(app, 14);
            layoutParams.y = dp(app, 160);

            windowManager.addView(bubbleView, layoutParams);
            overlayView = bubbleView;
            startTicker(app);
            refreshChronoText();
            Log.i(TAG, "entrenando bubble (matched design) added");
        } catch (Exception e) {
            Log.e(TAG, "show overlay failed", e);
            remove(context);
        }
    }

    private static void startTicker(Context app) {
        stopTicker();
        tickHandler = new android.os.Handler(app.getMainLooper());
        tickRunnable = new Runnable() {
            @Override
            public void run() {
                refreshChronoText();
                if (tickHandler != null) tickHandler.postDelayed(this, 1000);
            }
        };
        tickHandler.post(tickRunnable);
    }

    private static void stopTicker() {
        if (tickHandler != null && tickRunnable != null) {
            tickHandler.removeCallbacks(tickRunnable);
        }
        tickHandler = null;
        tickRunnable = null;
    }

    private static void refreshChronoText() {
        if (bubbleView == null) return;
        long now = System.currentTimeMillis();
        long seconds;
        if (countDownCached) {
            seconds = Math.max(0L, (whenMsCached - now) / 1000L);
        } else {
            seconds = Math.max(0L, (now - whenMsCached) / 1000L);
        }
        long m = seconds / 60;
        long s = seconds % 60;
        // Match formatTime in JS: M:SS for < 60m, else H:MM:SS-ish — keep M:SS
        bubbleView.setTimeText(String.format("%d:%02d", m, s));
        bubbleView.setProgress(progressCached <= 0f ? 0.08f : progressCached);
    }

    private static void forceDetach(Context app) {
        try {
            if (windowManager == null) {
                windowManager = (WindowManager) app.getSystemService(Context.WINDOW_SERVICE);
            }
            if (windowManager != null && overlayView != null) {
                windowManager.removeViewImmediate(overlayView);
            }
        } catch (Exception ignored) {
            /* already gone */
        }
        overlayView = null;
        bubbleView = null;
        layoutParams = null;
    }

    public static void remove(Context context) {
        stopTicker();
        try {
            forceDetach(context.getApplicationContext());
        } catch (Exception ignored) {
            /* ignore */
        }
    }

    private static int dp(Context context, int value) {
        float d = context.getResources().getDisplayMetrics().density;
        return Math.round(value * d);
    }
}
