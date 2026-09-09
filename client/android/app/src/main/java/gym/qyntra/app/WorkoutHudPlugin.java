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
            ed.putString("bubbleLabel", call.getString("bubbleLabel", "Entreno"));
            ed.putBoolean("showChronometer", Boolean.TRUE.equals(call.getBoolean("showChronometer", true)));
            ed.putBoolean("countDown", Boolean.TRUE.equals(call.getBoolean("countDown", false)));
            ed.putBoolean("inRest", Boolean.TRUE.equals(call.getBoolean("countDown", false)));
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
            call.getString("bubbleLabel", call.getString("content", "Entreno"))
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
        ret.put("channelBlocked", WorkoutHudNotifier.channelBlocked(getContext()));
        ret.put("notifications", notificationsAllowed() ? "granted" : "denied");
        ret.put(
            "overlay",
            Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext())
                ? "granted"
                : "denied"
        );
        ret.put("notifId", WorkoutHudNotifier.NOTIF_ID);
        ret.put("channelId", WorkoutHudNotifier.CHANNEL_ID);
        return ret;
    }

    /**
     * 1) Post with NotificationManager only (visible immediately).
     * 2) Verify activeCount.
     * 3) Then optionally promote to FGS — FGS must never wipe a working shade notification.
     */
    private void doShow(PluginCall call) {
        final PluginCall saved = call;
        Runnable work = () -> {
            try {
                if (!notificationsAllowed()) {
                    saved.reject("Permiso de notificaciones denegado o apagado en Ajustes");
                    return;
                }
                if (WorkoutHudNotifier.channelBlocked(getContext())) {
                    saved.reject("Canal 'Entreno en vivo' está bloqueado en Ajustes de notificaciones");
                    return;
                }

                Intent extras = extrasFromCall(saved);
                Notification notification = WorkoutHudNotifier.buildFromIntent(getContext(), extras);

                boolean posted = WorkoutHudNotifier.notifyNow(getContext(), notification);
                persistActive(saved, true);

                new Handler(Looper.getMainLooper()).postDelayed(() -> {
                    int active = WorkoutHudNotifier.countActive(getContext());
                    Log.i(TAG, "after notify active=" + active + " posted=" + posted);

                    if (active <= 0 && posted) {
                        Notification plain = WorkoutHudNotifier.build(
                            getContext(),
                            saved.getString("title", "Entrenamiento en curso"),
                            saved.getString("content", "Sesión activa"),
                            saved.getString("content", "Sesión activa"),
                            false,
                            false,
                            System.currentTimeMillis(),
                            false
                        );
                        WorkoutHudNotifier.notifyNow(getContext(), plain);
                        active = WorkoutHudNotifier.countActive(getContext());
                    }

                    final int finalActive = active;
                    boolean visible = finalActive > 0 || (finalActive < 0 && posted);
                    if (!visible) {
                        saved.reject(
                            "Android no muestra la notificación (activeCount="
                                + finalActive
                                + ", enabled="
                                + notificationsAllowed()
                                + ", channelBlocked="
                                + WorkoutHudNotifier.channelBlocked(getContext())
                                + ")"
                        );
                        return;
                    }

                    // Overlay bubble needs FGS; only start when overlay permission is already granted
                    boolean canOverlay =
                        Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                            || Settings.canDrawOverlays(getContext());
                    if (canOverlay) {
                        try {
                            WorkoutHudService.startOrUpdate(getContext(), extras);
                        } catch (Exception e) {
                            Log.e(TAG, "FGS/overlay start failed (notif kept)", e);
                            WorkoutHudNotifier.notifyNow(
                                getContext(),
                                WorkoutHudNotifier.buildFromIntent(getContext(), extras)
                            );
                        }
                    }

                    saved.resolve(statusPayload(true, posted, finalActive));
                }, 250);
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
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(getContext())) {
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
    public void clear(PluginCall call) {
        try {
            prefs().edit().putBoolean("active", false).apply();
            WorkoutHudService.stop(getContext());
            WorkoutHudNotifier.cancel(getContext());
            call.resolve(new JSObject().put("ok", true));
        } catch (Exception e) {
            call.reject("clear failed", e);
        }
    }

    /** Immediate test notification (debug). Prefer show() for production. */
    @PluginMethod
    public void ping(PluginCall call) {
        try {
            if (!notificationsAllowed()) {
                call.reject("notifications denied");
                return;
            }
            Notification n = WorkoutHudNotifier.build(
                getContext(),
                "Entrenamiento en curso",
                "Sesión activa",
                "Sesión activa",
                true,
                false,
                System.currentTimeMillis(),
                false
            );
            boolean posted = WorkoutHudNotifier.notifyNow(getContext(), n);
            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                int active = WorkoutHudNotifier.countActive(getContext());
                if (active > 0 || (active < 0 && posted)) {
                    call.resolve(statusPayload(true, posted, active));
                } else {
                    call.reject("ping not visible activeCount=" + active);
                }
            }, 200);
        } catch (Exception e) {
            call.reject("ping failed", e);
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
            extras.putExtra(WorkoutHudService.EXTRA_BUBBLE_LABEL, sp.getString("bubbleLabel", "Entreno"));
            extras.putExtra(WorkoutHudService.EXTRA_SHOW_CHRONO, sp.getBoolean("showChronometer", true));
            extras.putExtra(WorkoutHudService.EXTRA_COUNT_DOWN, sp.getBoolean("countDown", false));
            extras.putExtra(WorkoutHudService.EXTRA_IN_REST, sp.getBoolean("inRest", false));
            extras.putExtra(WorkoutHudService.EXTRA_WHEN_MS, sp.getLong("whenMs", System.currentTimeMillis()));
            Notification n = WorkoutHudNotifier.buildFromIntent(context, extras);
            WorkoutHudNotifier.notifyNow(context, n);
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(context)) {
                try {
                    WorkoutHudService.startOrUpdate(context, extras);
                } catch (Exception ignored) {
                    /* keep shade notification */
                }
            }
        } catch (Exception e) {
            Log.e(TAG, "restoreIfNeeded failed", e);
        }
    }
}
