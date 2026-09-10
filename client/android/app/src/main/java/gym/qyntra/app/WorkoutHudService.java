package gym.qyntra.app;

import android.app.Notification;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.util.Log;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

/**
 * Foreground service: keeps the ongoing workout notification alive.
 * Overlay is owned by WorkoutHudOverlay (WindowManager), not this service's view tree.
 */
public class WorkoutHudService extends Service {
    private static final String TAG = "WorkoutHudService";

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
            try {
                stopForeground(STOP_FOREGROUND_REMOVE);
            } catch (Exception ignored) {
                /* ignore */
            }
            stopSelf();
            return START_NOT_STICKY;
        }

        Notification notification = WorkoutHudNotifier.buildFromIntent(this, intent);

        // MUST call startForeground after startForegroundService
        boolean fgsOk = false;
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
            fgsOk = true;
            Log.i(TAG, "startForeground ok");
        } catch (Exception e) {
            Log.e(TAG, "startForeground specialUse failed", e);
            try {
                startForeground(NOTIF_ID, notification);
                fgsOk = true;
            } catch (Exception e2) {
                Log.e(TAG, "startForeground fallback failed", e2);
                WorkoutHudNotifier.notifyNow(this, notification);
            }
        }

        if (intent != null) {
            String bubble = intent.getStringExtra(EXTRA_BUBBLE_LABEL);
            if (bubble == null || bubble.isEmpty()) bubble = "Entrenando";
            long whenMs = intent.getLongExtra(EXTRA_WHEN_MS, System.currentTimeMillis());
            boolean countDown = intent.getBooleanExtra(EXTRA_COUNT_DOWN, false);
            if (WorkoutHudOverlay.canDraw(this)) {
                WorkoutHudOverlay.show(this, bubble, whenMs, countDown);
            }
        }

        if (!fgsOk) {
            // Avoid lingering in illegal FGS state
            try {
                stopForeground(STOP_FOREGROUND_DETACH);
            } catch (Exception ignored) {
                /* ignore */
            }
            stopSelf();
            return START_NOT_STICKY;
        }

        return START_STICKY;
    }
}
