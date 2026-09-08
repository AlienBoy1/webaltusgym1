package gym.qyntra.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WorkoutHudPlugin.class);
        super.onCreate(savedInstanceState);
        createDefaultNotificationChannel();
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
