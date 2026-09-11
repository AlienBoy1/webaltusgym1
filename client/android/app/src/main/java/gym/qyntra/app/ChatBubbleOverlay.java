package gym.qyntra.app;

import android.animation.Animator;
import android.animation.AnimatorListenerAdapter;
import android.animation.ValueAnimator;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.animation.DecelerateInterpolator;
import android.widget.FrameLayout;
import android.widget.TextView;
import java.util.HashMap;
import java.util.Map;

/** Floating chat heads over other apps (Messenger-style, drag-to-dismiss). */
public final class ChatBubbleOverlay {
    private static final String TAG = "ChatBubbleOverlay";
    private static final Map<String, Head> heads = new HashMap<>();
    private static WindowManager windowManager;
    private static View dismissZone;
    private static WindowManager.LayoutParams dismissLp;
    private static boolean dismissArmed;

    private ChatBubbleOverlay() {}

    public static boolean canDraw(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context);
    }

    /** Never draw over the live WebView — only when the activity is backgrounded. */
    public static void show(Context context, String peerId, String name, String preview, int unread) {
        if (peerId == null || peerId.isEmpty()) return;
        if (!canDraw(context)) return;
        if (MainActivity.isInForeground()) {
            Log.i(TAG, "skip show — app in foreground (bubble waits for next push while backgrounded)");
            return;
        }
        try {
            Context app = context.getApplicationContext();
            ensureWm(app);

            Head existing = heads.get(peerId);
            if (existing != null && existing.view.getParent() != null) {
                existing.bubble.setPeerName(name);
                existing.bubble.setUnread(unread);
                return;
            }

            ChatBubbleView bubble = new ChatBubbleView(app);
            bubble.setPeerName(name != null ? name : "?");
            bubble.setUnread(Math.max(1, unread));
            bubble.setClickable(true);
            bubble.setAlpha(0f);
            bubble.setScaleX(0.6f);
            bubble.setScaleY(0.6f);

            int size = dp(app, 64);
            DisplayMetrics dm = app.getResources().getDisplayMetrics();
            WindowManager.LayoutParams lp = baseLp(size, size);
            lp.gravity = Gravity.TOP | Gravity.START;
            int index = heads.size();
            lp.x = dp(app, 12);
            lp.y = Math.min(dm.heightPixels - size - dp(app, 120), dp(app, 120) + index * dp(app, 72));

            final String peer = peerId;
            final String peerName = name != null ? name : "";

            bubble.setOnTouchListener(new View.OnTouchListener() {
                private int startX;
                private int startY;
                private float touchX;
                private float touchY;
                private boolean moved;

                @Override
                public boolean onTouch(View v, MotionEvent event) {
                    switch (event.getAction()) {
                        case MotionEvent.ACTION_DOWN:
                            startX = lp.x;
                            startY = lp.y;
                            touchX = event.getRawX();
                            touchY = event.getRawY();
                            moved = false;
                            showDismissZone(app, false);
                            return true;
                        case MotionEvent.ACTION_MOVE: {
                            int dx = Math.round(event.getRawX() - touchX);
                            int dy = Math.round(event.getRawY() - touchY);
                            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
                            lp.x = clamp(startX + dx, 0, dm.widthPixels - size);
                            lp.y = clamp(startY + dy, 0, dm.heightPixels - size);
                            try {
                                windowManager.updateViewLayout(bubble, lp);
                            } catch (Exception ignored) {}
                            boolean nearTrash = lp.y > dm.heightPixels - dp(app, 160);
                            showDismissZone(app, nearTrash);
                            return true;
                        }
                        case MotionEvent.ACTION_UP:
                        case MotionEvent.ACTION_CANCEL: {
                            boolean nearTrash = lp.y > dm.heightPixels - dp(app, 160);
                            hideDismissZone(app);
                            if (moved && nearTrash) {
                                animateDismiss(app, peer, bubble, lp);
                                return true;
                            }
                            if (!moved) {
                                Intent open = new Intent(app, MainActivity.class);
                                open.setFlags(
                                    Intent.FLAG_ACTIVITY_NEW_TASK
                                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
                                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                                );
                                open.putExtra("open_path", "/chat");
                                open.putExtra("chat_peer_id", peer);
                                open.putExtra("chat_peer_name", peerName);
                                app.startActivity(open);
                                hide(app, peer);
                            } else {
                                // Snap to nearest edge
                                int targetX = lp.x + size / 2 < dm.widthPixels / 2 ? dp(app, 8) : dm.widthPixels - size - dp(app, 8);
                                animateSnap(bubble, lp, targetX, lp.y);
                            }
                            return true;
                        }
                        default:
                            return false;
                    }
                }
            });

            windowManager.addView(bubble, lp);
            Head head = new Head();
            head.view = bubble;
            head.bubble = bubble;
            head.params = lp;
            heads.put(peerId, head);

            bubble.animate().alpha(1f).scaleX(1f).scaleY(1f).setDuration(220).setInterpolator(new DecelerateInterpolator()).start();
        } catch (Exception e) {
            Log.e(TAG, "show failed", e);
        }
    }

    public static void hide(Context context, String peerId) {
        try {
            if (peerId == null || peerId.isEmpty()) {
                hideAll(context);
                return;
            }
            Head head = heads.remove(peerId);
            if (head == null) return;
            ensureWm(context.getApplicationContext());
            if (windowManager != null && head.view.getParent() != null) {
                windowManager.removeView(head.view);
            }
            if (heads.isEmpty()) hideDismissZone(context.getApplicationContext());
        } catch (Exception e) {
            Log.e(TAG, "hide failed", e);
        }
    }

    public static void hideAll(Context context) {
        try {
            ensureWm(context.getApplicationContext());
            for (Head head : heads.values()) {
                try {
                    if (windowManager != null && head.view.getParent() != null) {
                        windowManager.removeView(head.view);
                    }
                } catch (Exception ignored) {}
            }
            heads.clear();
            hideDismissZone(context.getApplicationContext());
        } catch (Exception e) {
            Log.e(TAG, "hideAll failed", e);
        }
    }

    private static void animateDismiss(Context app, String peerId, View bubble, WindowManager.LayoutParams lp) {
        DisplayMetrics dm = app.getResources().getDisplayMetrics();
        ValueAnimator anim = ValueAnimator.ofFloat(0f, 1f);
        final int fromY = lp.y;
        final int toY = dm.heightPixels + dp(app, 80);
        anim.setDuration(220);
        anim.addUpdateListener(a -> {
            float t = (float) a.getAnimatedValue();
            lp.y = fromY + Math.round((toY - fromY) * t);
            bubble.setAlpha(1f - t);
            bubble.setScaleX(1f - 0.45f * t);
            bubble.setScaleY(1f - 0.45f * t);
            try {
                windowManager.updateViewLayout(bubble, lp);
            } catch (Exception ignored) {}
        });
        anim.addListener(new AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(Animator animation) {
                hide(app, peerId);
            }
        });
        anim.start();
    }

    private static void animateSnap(View bubble, WindowManager.LayoutParams lp, int toX, int toY) {
        ValueAnimator anim = ValueAnimator.ofFloat(0f, 1f);
        final int fromX = lp.x;
        final int fromY = lp.y;
        anim.setDuration(180);
        anim.setInterpolator(new DecelerateInterpolator());
        anim.addUpdateListener(a -> {
            float t = (float) a.getAnimatedValue();
            lp.x = fromX + Math.round((toX - fromX) * t);
            lp.y = fromY + Math.round((toY - fromY) * t);
            try {
                windowManager.updateViewLayout(bubble, lp);
            } catch (Exception ignored) {}
        });
        anim.start();
    }

    private static void showDismissZone(Context app, boolean armed) {
        try {
            ensureWm(app);
            DisplayMetrics dm = app.getResources().getDisplayMetrics();
            int h = dp(app, 96);
            if (dismissZone == null) {
                FrameLayout zone = new FrameLayout(app);
                GradientDrawable bg = new GradientDrawable(
                    GradientDrawable.Orientation.BOTTOM_TOP,
                    new int[]{0xCC000000, 0x00000000}
                );
                zone.setBackground(bg);

                TextView label = new TextView(app);
                label.setText("Arrastra aquí para cerrar");
                label.setTextColor(Color.WHITE);
                label.setTextSize(13f);
                label.setGravity(Gravity.CENTER);
                FrameLayout.LayoutParams tlp = new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL
                );
                tlp.bottomMargin = dp(app, 28);
                zone.addView(label, tlp);
                dismissZone = zone;

                dismissLp = baseLp(WindowManager.LayoutParams.MATCH_PARENT, h);
                dismissLp.gravity = Gravity.BOTTOM;
                dismissLp.flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE
                    | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS;
            }
            dismissArmed = armed;
            dismissZone.setAlpha(armed ? 1f : 0.72f);
            if (dismissZone.getParent() == null) {
                windowManager.addView(dismissZone, dismissLp);
            } else {
                windowManager.updateViewLayout(dismissZone, dismissLp);
            }
        } catch (Exception e) {
            Log.e(TAG, "showDismissZone", e);
        }
    }

    private static void hideDismissZone(Context app) {
        try {
            if (dismissZone == null) return;
            ensureWm(app);
            if (dismissZone.getParent() != null && windowManager != null) {
                windowManager.removeView(dismissZone);
            }
            dismissArmed = false;
        } catch (Exception ignored) {}
    }

    private static void ensureWm(Context app) {
        if (windowManager == null) {
            windowManager = (WindowManager) app.getSystemService(Context.WINDOW_SERVICE);
        }
    }

    private static WindowManager.LayoutParams baseLp(int w, int h) {
        return new WindowManager.LayoutParams(
            w,
            h,
            Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                : WindowManager.LayoutParams.TYPE_PHONE,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        );
    }

    private static int dp(Context context, float v) {
        return Math.round(v * context.getResources().getDisplayMetrics().density);
    }

    private static int clamp(int v, int min, int max) {
        return Math.max(min, Math.min(max, v));
    }

    private static final class Head {
        View view;
        ChatBubbleView bubble;
        WindowManager.LayoutParams params;
    }
}
