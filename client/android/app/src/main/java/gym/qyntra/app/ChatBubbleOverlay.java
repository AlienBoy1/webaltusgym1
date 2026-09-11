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
import java.util.HashMap;
import java.util.Map;

/** Floating chat heads over other apps (one per peer). */
public final class ChatBubbleOverlay {
    private static final String TAG = "ChatBubbleOverlay";
    private static final Map<String, Head> heads = new HashMap<>();
    private static WindowManager windowManager;

    private ChatBubbleOverlay() {}

    public static boolean canDraw(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context);
    }

    public static void show(Context context, String peerId, String name, String preview, int unread) {
        if (peerId == null || peerId.isEmpty()) return;
        if (!canDraw(context)) return;
        try {
            Context app = context.getApplicationContext();
            if (windowManager == null) {
                windowManager = (WindowManager) app.getSystemService(Context.WINDOW_SERVICE);
            }
            if (windowManager == null) return;

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

            int size = dp(app, 64);
            WindowManager.LayoutParams lp = new WindowManager.LayoutParams(
                size,
                size,
                Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    : WindowManager.LayoutParams.TYPE_PHONE,
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                    | WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
                PixelFormat.TRANSLUCENT
            );
            lp.gravity = Gravity.TOP | Gravity.START;
            int index = heads.size();
            lp.x = dp(app, 12);
            lp.y = dp(app, 120) + index * dp(app, 72);

            bubble.setOnClickListener(v -> {
                Intent open = new Intent(app, MainActivity.class);
                open.setFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                );
                open.putExtra("open_path", "/chat");
                open.putExtra("chat_peer_id", peerId);
                open.putExtra("chat_peer_name", name != null ? name : "");
                app.startActivity(open);
                hide(app, peerId);
            });

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
                            return true;
                        case MotionEvent.ACTION_MOVE:
                            int dx = Math.round(event.getRawX() - touchX);
                            int dy = Math.round(event.getRawY() - touchY);
                            if (Math.abs(dx) > 4 || Math.abs(dy) > 4) moved = true;
                            lp.x = Math.max(0, startX + dx);
                            lp.y = Math.max(0, startY + dy);
                            try {
                                windowManager.updateViewLayout(bubble, lp);
                            } catch (Exception ignored) {}
                            return true;
                        case MotionEvent.ACTION_UP:
                            if (!moved) v.performClick();
                            return true;
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
            if (windowManager == null) {
                windowManager = (WindowManager) context.getApplicationContext()
                    .getSystemService(Context.WINDOW_SERVICE);
            }
            if (windowManager != null && head.view.getParent() != null) {
                windowManager.removeView(head.view);
            }
        } catch (Exception e) {
            Log.e(TAG, "hide failed", e);
        }
    }

    public static void hideAll(Context context) {
        try {
            if (windowManager == null) {
                windowManager = (WindowManager) context.getApplicationContext()
                    .getSystemService(Context.WINDOW_SERVICE);
            }
            for (Head head : heads.values()) {
                try {
                    if (windowManager != null && head.view.getParent() != null) {
                        windowManager.removeView(head.view);
                    }
                } catch (Exception ignored) {}
            }
            heads.clear();
        } catch (Exception e) {
            Log.e(TAG, "hideAll failed", e);
        }
    }

    private static int dp(Context context, float v) {
        return Math.round(v * context.getResources().getDisplayMetrics().density);
    }

    private static final class Head {
        View view;
        ChatBubbleView bubble;
        WindowManager.LayoutParams params;
    }
}
