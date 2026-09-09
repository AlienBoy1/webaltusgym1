package gym.qyntra.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Ongoing workout HUD: updates in place with Android chronometer
 * (no cancel/recreate → no sound / flicker).
 */
@CapacitorPlugin(name = "WorkoutHud")
public class WorkoutHudPlugin extends Plugin {
    /** Distinct from legacy LocalNotifications id (42001) so cancel() cannot wipe this HUD. */
    public static final int NOTIF_ID = 42011;
    public static final String CHANNEL_ID = "qyntra_workout_chrono";

    private void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm == null) return;
        NotificationChannel existing = nm.getNotificationChannel(CHANNEL_ID);
        if (existing != null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Entreno en vivo",
            NotificationManager.IMPORTANCE_LOW
        );
        channel.setDescription("Temporizador de sesión (sin sonido)");
        channel.setSound(null, null);
        channel.enableVibration(false);
        channel.setShowBadge(false);
        nm.createNotificationChannel(channel);
    }

    private PendingIntent contentIntent(Context context) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        intent.putExtra("workout_hud", true);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.getActivity(context, 0, intent, flags);
    }

    @PluginMethod
    public void show(PluginCall call) {
        Context context = getContext();
        ensureChannel(context);

        String title = call.getString("title", "Entrenamiento en curso");
        String content = call.getString("content", "");
        String bigText = call.getString("bigText", content);
        boolean showChronometer = Boolean.TRUE.equals(call.getBoolean("showChronometer", true));
        boolean countDown = Boolean.TRUE.equals(call.getBoolean("countDown", false));
        Long whenMs = call.getLong("whenMs");
        if (whenMs == null) whenMs = System.currentTimeMillis();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_qyntra)
            .setContentTitle(title)
            .setContentText(content)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(bigText))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setSilent(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setContentIntent(contentIntent(context));

        if (showChronometer) {
            builder.setUsesChronometer(true);
            builder.setChronometerCountDown(countDown);
            builder.setShowWhen(true);
            builder.setWhen(whenMs);
        } else {
            builder.setUsesChronometer(false);
            builder.setShowWhen(false);
        }

        try {
            NotificationManagerCompat.from(context).notify(NOTIF_ID, builder.build());
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (SecurityException se) {
            call.reject("Notification permission denied", se);
        } catch (Exception e) {
            call.reject("Failed to show workout HUD", e);
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        try {
            NotificationManagerCompat.from(getContext()).cancel(NOTIF_ID);
            JSObject ret = new JSObject();
            ret.put("ok", true);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to clear workout HUD", e);
        }
    }
}
