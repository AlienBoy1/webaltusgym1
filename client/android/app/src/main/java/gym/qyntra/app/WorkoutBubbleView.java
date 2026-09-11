package gym.qyntra.app;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.util.AttributeSet;
import android.view.View;

/**
 * Glass "entrenando" bubble — translucent so content behind remains visible,
 * matching the in-app WorkoutFloatingPanel collapsed look.
 */
public final class WorkoutBubbleView extends View {
    private final Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint borderPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint trackPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint arcPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint labelPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint timePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint shadowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final RectF arcRect = new RectF();

    private String timeText = "0:00";
    private float progress = 0.08f;

    public WorkoutBubbleView(Context context) {
        super(context);
        init();
    }

    public WorkoutBubbleView(Context context, AttributeSet attrs) {
        super(context, attrs);
        init();
    }

    private void init() {
        // Translucent glass (~55% opacity) so wallpaper/apps show through
        fillPaint.setStyle(Paint.Style.FILL);
        fillPaint.setColor(0x8C14141C);

        borderPaint.setStyle(Paint.Style.STROKE);
        borderPaint.setStrokeWidth(dp(1.2f));
        borderPaint.setColor(0x66FFFFFF);

        trackPaint.setStyle(Paint.Style.STROKE);
        trackPaint.setStrokeWidth(dp(3f));
        trackPaint.setStrokeCap(Paint.Cap.ROUND);
        trackPaint.setColor(0x55FFFFFF);

        arcPaint.setStyle(Paint.Style.STROKE);
        arcPaint.setStrokeWidth(dp(3f));
        arcPaint.setStrokeCap(Paint.Cap.ROUND);

        shadowPaint.setStyle(Paint.Style.FILL);
        shadowPaint.setColor(0x55000000);
        shadowPaint.setShadowLayer(dp(10f), 0, dp(3f), 0x66000000);

        labelPaint.setColor(0xFFFFFFFF);
        labelPaint.setTextAlign(Paint.Align.CENTER);
        labelPaint.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        labelPaint.setLetterSpacing(0.14f);
        labelPaint.setTextSize(sp(8.5f));
        labelPaint.setShadowLayer(dp(2f), 0, dp(1f), 0x99000000);

        timePaint.setColor(0xFFFFFFFF);
        timePaint.setTextAlign(Paint.Align.CENTER);
        timePaint.setTypeface(Typeface.create(Typeface.MONOSPACE, Typeface.BOLD));
        timePaint.setTextSize(sp(15f));
        timePaint.setShadowLayer(dp(2.5f), 0, dp(1f), 0xAA000000);

        setLayerType(LAYER_TYPE_SOFTWARE, null);
    }

    public void setTimeText(String text) {
        if (text == null) text = "0:00";
        if (text.equals(timeText)) return;
        timeText = text;
        invalidate();
    }

    public void setProgress(float p) {
        float next = Math.max(0f, Math.min(1f, p));
        if (Math.abs(next - progress) < 0.001f) return;
        progress = next;
        invalidate();
    }

    @Override
    protected void onSizeChanged(int w, int h, int oldw, int oldh) {
        super.onSizeChanged(w, h, oldw, oldh);
        float pad = dp(8f);
        arcRect.set(pad, pad, w - pad, h - pad);
        LinearGradient gradient = new LinearGradient(
            arcRect.left,
            arcRect.top,
            arcRect.right,
            arcRect.bottom,
            new int[]{0xFFFF6B35, 0xFF00F5FF},
            null,
            Shader.TileMode.CLAMP
        );
        arcPaint.setShader(gradient);
    }

    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        float cx = getWidth() / 2f;
        float cy = getHeight() / 2f;
        float radius = Math.min(cx, cy) - dp(2f);

        // Soft drop shadow disc
        canvas.drawCircle(cx, cy + dp(1.5f), radius, shadowPaint);

        // Translucent glass fill + rim
        canvas.drawCircle(cx, cy, radius, fillPaint);
        canvas.drawCircle(cx, cy, radius, borderPaint);

        // Subtle brand tint wash (like from-primary/25 in CSS)
        Paint wash = new Paint(Paint.ANTI_ALIAS_FLAG);
        wash.setStyle(Paint.Style.FILL);
        wash.setShader(new LinearGradient(
            cx - radius, cy - radius, cx + radius, cy + radius,
            new int[]{0x40FF6B35, 0x00000000, 0x3300F5FF},
            new float[]{0f, 0.45f, 1f},
            Shader.TileMode.CLAMP
        ));
        canvas.drawCircle(cx, cy, radius - dp(1f), wash);

        canvas.drawArc(arcRect, -90f, 360f, false, trackPaint);
        float sweep = 360f * progress;
        if (sweep > 0f && sweep < 8f) sweep = 8f;
        if (sweep > 0f) canvas.drawArc(arcRect, -90f, sweep, false, arcPaint);

        canvas.drawText("ENTRENANDO", cx, cy - dp(6f), labelPaint);
        canvas.drawText(timeText, cx, cy + dp(12f), timePaint);
    }

    private float dp(float value) {
        return value * getResources().getDisplayMetrics().density;
    }

    private float sp(float value) {
        return value * getResources().getDisplayMetrics().scaledDensity;
    }
}
