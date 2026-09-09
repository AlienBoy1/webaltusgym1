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

/** Direct NotificationManager posting for the live workout HUD. */
public final class WorkoutHudNotifier {
    private static final String TAG = "WorkoutHudNotifier";

    public static final int NOTIF_ID = 99101;
    public static final String CHANNEL_ID = "qyntra_workout_live_v8";

    public static final String ACTION_COMPLETE = "gym.qyntra.app.workout.COMPLETE";
    public static final String ACTION_SKIP_REST = "gym.qyntra.app.workout.SKIP_REST";
    public static final String ACTION_OPEN = "gym.qyntra.app.workout.OPEN";

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
        channel.enableVibration(true);
        channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(channel);
        Log.i(TAG, "channel created " + CHANNEL_ID);
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

    /** White silhouette for status bar (Android requirement). */
    public static int smallIcon(Context context) {
        int res = context.getResources().getIdentifier("ic_stat_qyntra", "drawable", context.getPackageName());
        if (res != 0) return res;
        return android.R.drawable.ic_media_play;
    }

    /** Color app logo shown as large icon in expanded notification. */
    public static Bitmap largeIcon(Context context) {
        try {
            int res = context.getResources().getIdentifier("ic_launcher", "mipmap", context.getPackageName());
            if (res == 0) {
                res = context.getResources().getIdentifier("ic_launcher_round", "mipmap", context.getPackageName());
            }
            if (res != 0) {
                return BitmapFactory.decodeResource(context.getResources(), res);
            }
        } catch (Exception e) {
            Log.w(TAG, "largeIcon failed", e);
        }
        return null;
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
        if (title == null || title.isEmpty()) title = "Entrenamiento en curso";
        if (content == null || content.isEmpty()) content = "Sesión activa";
        if (bigText == null || bigText.isEmpty()) bigText = content;
        if (whenMs <= 0) whenMs = System.currentTimeMillis();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(smallIcon(context))
            .setContentTitle(title)
            .setContentText(content)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(bigText))
            .setOngoing(true)
            .setAutoCancel(false)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_STOPWATCH)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(contentIntent(context))
            .setColor(0xFFFF8A3D)
            .setDefaults(NotificationCompat.DEFAULT_ALL)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE);

        Bitmap large = largeIcon(context);
        if (large != null) {
            builder.setLargeIcon(large);
        }

        if (showChrono) {
            builder.setUsesChronometer(true);
            builder.setChronometerCountDown(countDown);
            builder.setShowWhen(true);
            builder.setWhen(whenMs);
        }

        if (inRest) {
            builder.addAction(
                0,
                "Saltar descanso",
                actionIntent(context, "skip_rest", NOTIF_ID + 2)
            );
        } else {
            builder.addAction(
                0,
                "Completar",
                actionIntent(context, "complete", NOTIF_ID + 1)
            );
        }
        builder.addAction(
            0,
            "Abrir",
            actionIntent(context, "open", NOTIF_ID + 3)
        );

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
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) {
                Log.e(TAG, "NotificationManager null");
                return false;
            }
            nm.notify(NOTIF_ID, notification);
            Log.i(TAG, "notifyNow active=" + countActive(context));
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
            StatusBarNotification[] active = nm.getActiveNotifications();
            int count = 0;
            for (StatusBarNotification sbn : active) {
                if (sbn.getId() == NOTIF_ID) count++;
            }
            return count;
        } catch (Exception e) {
            Log.e(TAG, "countActive failed", e);
            return -1;
        }
    }

    public static boolean channelBlocked(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false;
        try {
            NotificationManager nm = context.getSystemService(NotificationManager.class);
            if (nm == null) return true;
            if (!nm.areNotificationsEnabled()) return true;
            NotificationChannel ch = nm.getNotificationChannel(CHANNEL_ID);
            if (ch == null) return false;
            return ch.getImportance() == NotificationManager.IMPORTANCE_NONE;
        } catch (Exception e) {
            return false;
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
