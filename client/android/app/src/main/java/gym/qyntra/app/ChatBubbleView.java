package gym.qyntra.app;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.util.AttributeSet;
import android.view.View;

/** Circular Messenger-style chat head. */
public final class ChatBubbleView extends View {
    private final Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint letterPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint badgePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint badgeTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);

    private String letter = "?";
    private int unread = 1;

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
    }

    public void setPeerName(String name) {
        String n = name == null ? "" : name.trim();
        letter = n.isEmpty() ? "?" : String.valueOf(Character.toUpperCase(n.charAt(0)));
        invalidate();
    }

    public void setUnread(int count) {
        unread = Math.max(1, count);
        invalidate();
    }

    @Override
    protected void onDraw(Canvas canvas) {
        float cx = getWidth() / 2f;
        float cy = getHeight() / 2f;
        float r = Math.min(cx, cy) - dp(4f);
        canvas.drawCircle(cx, cy, r, fillPaint);
        canvas.drawCircle(cx, cy, r, borderPaint);
        Paint.FontMetrics fm = letterPaint.getFontMetrics();
        float textY = cy - (fm.ascent + fm.descent) / 2f;
        canvas.drawText(letter, cx, textY, letterPaint);

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
