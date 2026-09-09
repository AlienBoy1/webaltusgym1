package gym.qyntra.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkoutHudPlugin.class);
        super.onCreate(savedInstanceState);
        createDefaultNotificationChannel();
        handleWorkoutOpenIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleWorkoutOpenIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        WorkoutHudPlugin.restoreIfNeeded(this);
    }

    private void handleWorkoutOpenIntent(Intent intent) {
        if (intent == null) return;
        String path = intent.getStringExtra("open_path");
        String action = intent.getStringExtra("workout_action");
        if ((path == null || path.isEmpty()) && (action == null || action.isEmpty())) return;
        final String target = (path == null || path.isEmpty())
            ? "/workouts"
            : (path.startsWith("/") ? path : "/" + path);
        final String act = action != null ? action : "open";
        getWindow().getDecorView().postDelayed(() -> {
            try {
                if (getBridge() == null || getBridge().getWebView() == null) return;
                String js =
                    "(function(){try{" +
                    "window.dispatchEvent(new CustomEvent('qyntra:native-open',{detail:{path:'" + target + "',action:'" + act + "'}}));" +
                    "window.dispatchEvent(new CustomEvent('qyntra:workout-action',{detail:{action:'" + act + "'}}));" +
                    "if(window.location.pathname!=='" + target + "'){window.location.assign('" + target + "');}" +
                    "}catch(e){}})();";
                getBridge().getWebView().evaluateJavascript(js, null);
            } catch (Exception ignored) {
                /* bridge not ready */
            }
        }, 500);
    }

    private void createDefaultNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationChannel channel = new NotificationChannel(
            "qyntra_default",
            "Qyntra",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Notificaciones de Qyntra Gym");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) {
            manager.createNotificationChannel(channel);
        }
    }
}
