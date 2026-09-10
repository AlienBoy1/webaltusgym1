package gym.qyntra.app;

import android.Manifest;
import android.app.Notification;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "WorkoutHud",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class WorkoutHudPlugin extends Plugin {
    private static final String TAG = "WorkoutHud";
    private static final String PREFS = "qyntra_workout_hud";

    private boolean notificationsAllowed() {
        if (!NotificationManagerCompat.from(getContext()).areNotificationsEnabled()) {
            return false;
        }
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return true;
        return ContextCompat.checkSelfPermission(
            getContext(),
            Manifest.permission.POST_NOTIFICATIONS
        ) == PackageManager.PERMISSION_GRANTED;
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE);
    }

    private void persistActive(PluginCall call, boolean active) {
        SharedPreferences.Editor ed = prefs().edit().putBoolean("active", active);
        if (active) {
            ed.putString("title", call.getString("title", "Entrenamiento en curso"));
            ed.putString("content", call.getString("content", ""));
            ed.putString("bigText", call.getString("bigText", call.getString("content", "")));
            ed.putString("bubbleLabel", call.getString("bubbleLabel", "Entrenando"));
            ed.putBoolean("showChronometer", Boolean.TRUE.equals(call.getBoolean("showChronometer", true)));
            boolean countDown = Boolean.TRUE.equals(call.getBoolean("countDown", false));
            ed.putBoolean("countDown", countDown);
            ed.putBoolean("inRest", countDown);
            Double whenDouble = call.getDouble("whenMs");
            long whenMs = whenDouble != null && whenDouble > 0
                ? whenDouble.longValue()
                : System.currentTimeMillis();
            ed.putLong("whenMs", whenMs);
        }
        ed.apply();
    }

    private Intent extrasFromCall(PluginCall call) {
        Intent extras = new Intent();
        extras.putExtra(WorkoutHudService.EXTRA_TITLE, call.getString("title", "Entrenamiento en curso"));
        extras.putExtra(WorkoutHudService.EXTRA_CONTENT, call.getString("content", ""));
        extras.putExtra(
            WorkoutHudService.EXTRA_BIG_TEXT,
            call.getString("bigText", call.getString("content", ""))
        );
        extras.putExtra(
            WorkoutHudService.EXTRA_BUBBLE_LABEL,
            call.getString("bubbleLabel", "Entrenando")
        );
        extras.putExtra(
            WorkoutHudService.EXTRA_SHOW_CHRONO,
            Boolean.TRUE.equals(call.getBoolean("showChronometer", true))
        );
        boolean countDown = Boolean.TRUE.equals(call.getBoolean("countDown", false));
        extras.putExtra(WorkoutHudService.EXTRA_COUNT_DOWN, countDown);
        extras.putExtra(WorkoutHudService.EXTRA_IN_REST, countDown);
        Double whenDouble = call.getDouble("whenMs");
        long whenMs = whenDouble != null && whenDouble > 0
            ? whenDouble.longValue()
            : System.currentTimeMillis();
        extras.putExtra(WorkoutHudService.EXTRA_WHEN_MS, whenMs);
        return extras;
    }

    private JSObject statusPayload(boolean ok, boolean posted, int active) {
        JSObject ret = new JSObject();
        ret.put("ok", ok);
        ret.put("posted", posted);
        ret.put("activeCount", active);
        ret.put("notifications", notificationsAllowed() ? "granted" : "denied");
        ret.put("overlay", WorkoutHudOverlay.canDraw(getContext()) ? "granted" : "denied");
        ret.put("notifId", WorkoutHudNotifier.NOTIF_ID);
        ret.put("channelId", WorkoutHudNotifier.CHANNEL_ID);
        return ret;
    }

    private void applyHud(Intent extras) {
        // Critical path: NotificationManager + SYSTEM_ALERT_WINDOW only.
        // Do NOT start WorkoutHudService here — failed specialUse FGS after
        // startForegroundService crashes the process and wipes the shade notif.
        Notification notification = WorkoutHudNotifier.buildFromIntent(getContext(), extras);
        WorkoutHudNotifier.notifyNow(getContext(), notification);

        String bubble = extras.getStringExtra(WorkoutHudService.EXTRA_BUBBLE_LABEL);
        long whenMs = extras.getLongExtra(WorkoutHudService.EXTRA_WHEN_MS, System.currentTimeMillis());
        boolean countDown = extras.getBooleanExtra(WorkoutHudService.EXTRA_COUNT_DOWN, false);

        if (WorkoutHudOverlay.canDraw(getContext())) {
            WorkoutHudOverlay.show(getContext(), bubble, whenMs, countDown);
        }
    }

    private void doShow(PluginCall call) {
        final PluginCall saved = call;
        Runnable work = () -> {
            try {
                if (!notificationsAllowed()) {
                    saved.reject("Activa Notificaciones para Qyntra en Ajustes");
                    return;
                }

                Intent extras = extrasFromCall(saved);
                persistActive(saved, true);
                applyHud(extras);

                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    int active = WorkoutHudNotifier.countActive(getContext());
                    if (active <= 0) {
                        // Hard retry without FGS
                        WorkoutHudNotifier.notifyNow(
                            getContext(),
                            WorkoutHudNotifier.buildFromIntent(getContext(), extras)
                        );
                        active = WorkoutHudNotifier.countActive(getContext());
                    }
                    boolean ok = active > 0 || active < 0;
                    if (ok) {
                        saved.resolve(statusPayload(true, true, active));
                    } else {
                        saved.reject("Android no muestra la notificación (activeCount=0). Revisa Ajustes → Notificaciones → Entreno en vivo");
                    }
                }, 400);
            } catch (Exception e) {
                Log.e(TAG, "doShow failed", e);
                saved.reject("doShow failed: " + e.getMessage(), e);
            }
        };

        if (getActivity() != null) {
            getActivity().runOnUiThread(work);
        } else {
            work.run();
        }
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        call.resolve(statusPayload(false, false, WorkoutHudNotifier.countActive(getContext())));
    }

    @PluginMethod
    public void requestPermissions(PluginCall call) {
        if (notificationsAllowed()) {
            call.resolve(new JSObject().put("notifications", "granted"));
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAlias("notifications", call, "notificationsPermsCallback");
            return;
        }
        call.resolve(new JSObject().put("notifications", "denied"));
    }

    @PermissionCallback
    private void notificationsPermsCallback(PluginCall call) {
        call.resolve(new JSObject().put("notifications", notificationsAllowed() ? "granted" : "denied"));
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent intent = new Intent();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent.setAction(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.parse("package:" + getContext().getPackageName()));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception e) {
            call.reject("Cannot open settings", e);
        }
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        if (WorkoutHudOverlay.canDraw(getContext())) {
            call.resolve(new JSObject().put("overlay", "granted"));
            return;
        }
        try {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + getContext().getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve(new JSObject().put("overlay", "prompt"));
        } catch (Exception e) {
            call.reject("Cannot open overlay settings", e);
        }
    }

    @PluginMethod
    public void show(PluginCall call) {
        if (notificationsAllowed()) {
            doShow(call);
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            requestPermissionForAlias("notifications", call, "showAfterPerms");
            return;
        }
        call.reject("Notification permission denied");
    }

    @PermissionCallback
    private void showAfterPerms(PluginCall call) {
        if (!notificationsAllowed()) {
            call.reject("Notification permission denied");
            return;
        }
        doShow(call);
    }

    @PluginMethod
    public void startOverlay(PluginCall call) {
        try {
            SharedPreferences sp = prefs();
            if (!sp.getBoolean("active", false)) {
                call.reject("No active workout");
                return;
            }
            if (!WorkoutHudOverlay.canDraw(getContext())) {
                call.resolve(new JSObject().put("ok", false).put("overlay", "denied"));
                return;
            }
            Intent extras = new Intent();
            extras.putExtra(WorkoutHudService.EXTRA_TITLE, sp.getString("title", "Entrenamiento en curso"));
            extras.putExtra(WorkoutHudService.EXTRA_CONTENT, sp.getString("content", ""));
            extras.putExtra(WorkoutHudService.EXTRA_BIG_TEXT, sp.getString("bigText", ""));
            extras.putExtra(WorkoutHudService.EXTRA_BUBBLE_LABEL, sp.getString("bubbleLabel", "Entrenando"));
            extras.putExtra(WorkoutHudService.EXTRA_SHOW_CHRONO, sp.getBoolean("showChronometer", true));
            extras.putExtra(WorkoutHudService.EXTRA_COUNT_DOWN, sp.getBoolean("countDown", false));
            extras.putExtra(WorkoutHudService.EXTRA_IN_REST, sp.getBoolean("inRest", false));
            extras.putExtra(WorkoutHudService.EXTRA_WHEN_MS, sp.getLong("whenMs", System.currentTimeMillis()));
            applyHud(extras);
            call.resolve(new JSObject().put("ok", true).put("overlay", "granted"));
        } catch (Exception e) {
            call.reject("startOverlay failed", e);
        }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        try {
            prefs().edit().putBoolean("active", false).apply();
            WorkoutHudOverlay.remove(getContext());
            try {
                WorkoutHudService.stop(getContext());
            } catch (Exception ignored) {
                /* ignore */
            }
            WorkoutHudNotifier.cancel(getContext());
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception e) {
            call.reject("clear failed", e);
        }
    }

    public static void restoreIfNeeded(android.content.Context context) {
        try {
            SharedPreferences sp = context.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE);
            if (!sp.getBoolean("active", false)) return;
            Intent extras = new Intent();
            extras.putExtra(WorkoutHudService.EXTRA_TITLE, sp.getString("title", "Entrenamiento en curso"));
            extras.putExtra(WorkoutHudService.EXTRA_CONTENT, sp.getString("content", ""));
            extras.putExtra(WorkoutHudService.EXTRA_BIG_TEXT, sp.getString("bigText", ""));
            extras.putExtra(WorkoutHudService.EXTRA_BUBBLE_LABEL, sp.getString("bubbleLabel", "Entrenando"));
            extras.putExtra(WorkoutHudService.EXTRA_SHOW_CHRONO, sp.getBoolean("showChronometer", true));
            extras.putExtra(WorkoutHudService.EXTRA_COUNT_DOWN, sp.getBoolean("countDown", false));
            extras.putExtra(WorkoutHudService.EXTRA_IN_REST, sp.getBoolean("inRest", false));
            extras.putExtra(WorkoutHudService.EXTRA_WHEN_MS, sp.getLong("whenMs", System.currentTimeMillis()));
            WorkoutHudNotifier.notifyNow(context, WorkoutHudNotifier.buildFromIntent(context, extras));
            if (WorkoutHudOverlay.canDraw(context)) {
                WorkoutHudOverlay.show(
                    context,
                    sp.getString("bubbleLabel", "Entrenando"),
                    sp.getLong("whenMs", System.currentTimeMillis()),
                    sp.getBoolean("countDown", false)
                );
            }
        } catch (Exception e) {
            Log.e(TAG, "restoreIfNeeded failed", e);
        }
    }
}
