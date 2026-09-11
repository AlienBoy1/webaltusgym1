package gym.qyntra.app;

import android.util.Log;
import androidx.annotation.NonNull;
import com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/**
 * Replaces Capacitor's MessagingService so we can:
 * - show chat notification actions
 * - draw chat heads when bubble is enabled for that peer
 * - ACK delivered using stored JWT
 * while still forwarding events to the Capacitor plugin.
 */
public final class QyntraMessagingService extends FirebaseMessagingService {
    private static final String TAG = "QyntraMessaging";

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        Map<String, String> data = remoteMessage.getData();
        String type = data != null ? data.get("type") : null;

        if ("message".equals(type)) {
            String peerId = first(data, "fromUserId", "from_user_id");
            String title = first(data, "title", "fromName");
            String body = first(data, "body", "preview", "message");
            if (title == null && remoteMessage.getNotification() != null) {
                title = remoteMessage.getNotification().getTitle();
            }
            if (body == null && remoteMessage.getNotification() != null) {
                body = remoteMessage.getNotification().getBody();
            }
            if (peerId != null && !peerId.isEmpty()) {
                ChatBubbleStore.showMessageNotification(
                    this,
                    peerId,
                    title != null ? title : "Nuevo mensaje",
                    body != null ? body : ""
                );
                ChatBubbleStore.postChatReceipt(this, peerId, "delivered");
                if (ChatBubbleStore.isEnabled(this, peerId) && ChatBubbleOverlay.canDraw(this)) {
                    ChatBubbleOverlay.show(
                        this,
                        peerId,
                        title != null ? title : "?",
                        body != null ? body : "",
                        1
                    );
                }
            }
        }

        try {
            PushNotificationsPlugin.sendRemoteMessage(remoteMessage);
        } catch (Exception e) {
            Log.w(TAG, "forward to Capacitor failed", e);
        }
    }

    @Override
    public void onNewToken(@NonNull String token) {
        try {
            PushNotificationsPlugin.onNewToken(token);
        } catch (Exception e) {
            Log.w(TAG, "onNewToken forward failed", e);
        }
    }

    private static String first(Map<String, String> data, String... keys) {
        if (data == null) return null;
        for (String k : keys) {
            String v = data.get(k);
            if (v != null && !v.isEmpty()) return v;
        }
        return null;
    }
}
