package gym.qyntra.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Typeface;
import android.os.Handler;
import android.os.Looper;
import android.util.AttributeSet;
import android.util.Log;
import android.view.View;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** Circular Messenger-style chat head with optional profile photo. */
public final class ChatBubbleView extends View {
    private static final String TAG = "ChatBubbleView";
    private final Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint letterPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint badgePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint badgeTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint bitmapPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Path clipPath = new Path();

    private String letter = "?";
    private int unread = 1;
    private Bitmap avatar;
    private String avatarUrl;
    private final Handler main = new Handler(Looper.getMainLooper());

    public ChatBubbleView(Context context) {
        super(context);
        init();
    }

    public ChatBubbleView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    private void init() {
        fillPaint.setStyle(Paint.Style.FILL);
        fillPaint.setColor(0xE61A1A24);

        borderPaint.setStyle(Paint.Style.STROKE);
        borderPaint.setStrokeWidth(dp(2.5f));
        borderPaint.setColor(0xFFFF6B35);

        letterPaint.setColor(0xFFFFFFFF);
        letterPaint.setTextAlign(Paint.Align.CENTER);
        letterPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        letterPaint.setTextSize(sp(22f));

        badgePaint.setStyle(Paint.Style.FILL);
        badgePaint.setColor(0xFFFF3B30);

        badgeTextPaint.setColor(0xFFFFFFFF);
        badgeTextPaint.setTextAlign(Paint.Align.CENTER);
        badgeTextPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        badgeTextPaint.setTextSize(sp(10f));

        bitmapPaint.setFilterBitmap(true);
    }

    public void setPeerName(String name) {
        String n = name == null ? "" : name.trim();
        if (n.equalsIgnoreCase("Usuario") || n.isEmpty()) {
            letter = "?";
        } else {
            letter = String.valueOf(Character.toUpperCase(n.charAt(0)));
        }
        invalidate();
    }

    public void setUnread(int count) {
        unread = Math.max(1, count);
        invalidate();
    }

    public void setAvatarUrl(String url) {
        if (url == null) url = "";
        if (url.equals(avatarUrl)) return;
        avatarUrl = url;
        avatar = null;
        invalidate();
        if (url.isEmpty() || url.startsWith("icon:") || url.startsWith("data:")) {
            // data: URLs skipped on overlay for size; icon: not raster
            return;
        }
        final String loadUrl = url;
        new Thread(() -> {
            Bitmap bmp = null;
            try {
                HttpURLConnection conn = (HttpURLConnection) new URL(loadUrl).openConnection();
                conn.setConnectTimeout(8000);
                conn.setReadTimeout(8000);
                conn.setInstanceFollowRedirects(true);
                try (InputStream in = conn.getInputStream()) {
                    bmp = BitmapFactory.decodeStream(in);
                }
                conn.disconnect();
            } catch (Exception e) {
                Log.w(TAG, "avatar load failed: " + e.getMessage());
            }
            final Bitmap ready = bmp;
            main.post(() -> {
                if (!loadUrl.equals(avatarUrl)) return;
                avatar = ready;
                invalidate();
            });
        }, "chat-avatar").start();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        float cx = getWidth() / 2f;
        float cy = getHeight() / 2f;
        float r = Math.min(cx, cy) - dp(4f);

        canvas.drawCircle(cx, cy, r, fillPaint);

        if (avatar != null && !avatar.isRecycled()) {
            clipPath.reset();
            clipPath.addCircle(cx, cy, r - dp(1f), Path.Direction.CW);
            canvas.save();
            canvas.clipPath(clipPath);
            float scale = Math.max((r * 2f) / avatar.getWidth(), (r * 2f) / avatar.getHeight());
            float dw = avatar.getWidth() * scale;
            float dh = avatar.getHeight() * scale;
            android.graphics.RectF dest = new android.graphics.RectF(cx - dw / 2f, cy - dh / 2f, cx + dw / 2f, cy + dh / 2f);
            canvas.drawBitmap(avatar, null, dest, bitmapPaint);
            canvas.restore();
        } else {
            Paint.FontMetrics fm = letterPaint.getFontMetrics();
            float textY = cy - (fm.ascent + fm.descent) / 2f;
            canvas.drawText(letter, cx, textY, letterPaint);
        }

        canvas.drawCircle(cx, cy, r, borderPaint);

        float br = dp(11f);
        float bx = cx + r * 0.62f;
        float by = cy - r * 0.62f;
        canvas.drawCircle(bx, by, br, badgePaint);
        String badge = unread > 9 ? "9+" : String.valueOf(unread);
        Paint.FontMetrics bfm = badgeTextPaint.getFontMetrics();
        canvas.drawText(badge, bx, by - (bfm.ascent + bfm.descent) / 2f, badgeTextPaint);
    }

    private float dp(float v) {
        return v * getResources().getDisplayMetrics().density;
    }

    private float sp(float v) {
        return v * getResources().getDisplayMetrics().scaledDensity;
    }
}
