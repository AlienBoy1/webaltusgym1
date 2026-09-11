package gym.qyntra.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.os.Build;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import androidx.core.app.NotificationCompat;

/**
 * Shade notification for active workouts.
 */
public final class WorkoutHudNotifier {
    private static final String TAG = "WorkoutHudNotifier";

    public static final int NOTIF_ID = 99101;
    public static final String CHANNEL_ID = "qyntra_workout_live_v17";

    private WorkoutHudNotifier() {}

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        if (nm.getNotificationChannel(CHANNEL_ID) != null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Entreno en vivo",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Temporizador de entrenamiento");
        channel.setShowBadge(true);
        channel.enableVibration(false);
        channel.setSound(null, null);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(channel);
    }

    public static PendingIntent contentIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra("open_path", "/workouts");
        intent.putExtra("workout_action", "open");
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, NOTIF_ID, intent, flags);
    }

    private static PendingIntent actionIntent(Context context, String action, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        intent.putExtra("open_path", "/workouts");
        intent.putExtra("workout_action", action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, requestCode, intent, flags);
    }

    public static Notification build(
        Context context,
        String title,
        String content,
        String bigText,
        boolean showChrono,
        boolean countDown,
        long whenMs,
        boolean inRest
    ) {
        ensureChannel(context);
        if (title == null || title.isEmpty()) title = "Entrenamiento en vivo";
        if (content == null || content.isEmpty()) content = "Sesión activa";
        if (bigText == null || bigText.isEmpty()) bigText = content;
        if (whenMs <= 0) whenMs = System.currentTimeMillis();

        // smallIcon MUST be a white glyph on transparent (not the full launcher bitmap —
        // that becomes an opaque white square). Large icon keeps the real app mark.
        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_qyntra_q)
            .setContentTitle(title)
            .setContentText(content)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(bigText))
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_STATUS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(contentIntent(context))
            .setColor(0xFFFF6B35);

        try {
            Bitmap large = BitmapFactory.decodeResource(context.getResources(), R.mipmap.ic_launcher);
            if (large == null) {
                large = BitmapFactory.decodeResource(context.getResources(), R.drawable.ic_notification_app);
            }
            if (large != null) builder.setLargeIcon(large);
        } catch (Exception e) {
            Log.w(TAG, "largeIcon skipped", e);
        }

        if (showChrono) {
            builder.setUsesChronometer(true);
            builder.setChronometerCountDown(countDown);
            builder.setShowWhen(true);
            builder.setWhen(whenMs);
        }

        if (inRest) {
            builder.addAction(0, "Saltar descanso", actionIntent(context, "skip_rest", NOTIF_ID + 2));
        } else {
            builder.addAction(0, "Ejercicio completado", actionIntent(context, "complete", NOTIF_ID + 1));
        }
        builder.addAction(0, "Abrir", actionIntent(context, "open", NOTIF_ID + 3));
        builder.addAction(0, "Cancelar", actionIntent(context, "cancel", NOTIF_ID + 4));

        return builder.build();
    }

    public static Notification buildFromIntent(Context context, Intent intent) {
        String title = intent != null ? intent.getStringExtra(WorkoutHudService.EXTRA_TITLE) : null;
        String content = intent != null ? intent.getStringExtra(WorkoutHudService.EXTRA_CONTENT) : null;
        String bigText = intent != null ? intent.getStringExtra(WorkoutHudService.EXTRA_BIG_TEXT) : null;
        boolean showChrono = intent == null || intent.getBooleanExtra(WorkoutHudService.EXTRA_SHOW_CHRONO, true);
        boolean countDown = intent != null && intent.getBooleanExtra(WorkoutHudService.EXTRA_COUNT_DOWN, false);
        boolean inRest = intent != null && intent.getBooleanExtra(WorkoutHudService.EXTRA_IN_REST, false);
        long whenMs = intent != null
            ? intent.getLongExtra(WorkoutHudService.EXTRA_WHEN_MS, System.currentTimeMillis())
            : System.currentTimeMillis();
        return build(context, title, content, bigText, showChrono, countDown, whenMs, inRest || countDown);
    }

    public static boolean notifyNow(Context context, Notification notification) {
        try {
            ensureChannel(context);
            Context app = context.getApplicationContext();
            NotificationManager nm = (NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return false;
            nm.notify(NOTIF_ID, notification);
            Log.i(TAG, "notifyNow active=" + countActive(app));
            return true;
        } catch (SecurityException se) {
            Log.e(TAG, "POST_NOTIFICATIONS denied", se);
            return false;
        } catch (Exception e) {
            Log.e(TAG, "notifyNow failed", e);
            return false;
        }
    }

    public static int countActive(Context context) {
        try {
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return -1;
            NotificationManager nm = context.getSystemService(NotificationManager.class);
            if (nm == null) return 0;
            int count = 0;
            for (StatusBarNotification sbn : nm.getActiveNotifications()) {
                if (sbn.getId() == NOTIF_ID) count++;
            }
            return count;
        } catch (Exception e) {
            return -1;
        }
    }

    public static void cancel(Context context) {
        try {
            NotificationManager nm = context.getSystemService(NotificationManager.class);
            if (nm != null) nm.cancel(NOTIF_ID);
        } catch (Exception ignored) {
            /* ignore */
        }
    }
}
