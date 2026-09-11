package gym.qyntra.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Notification action: Marcar como leído. */
public final class ChatBubbleActionReceiver extends BroadcastReceiver {
    public static final String ACTION_MARK_READ = "gym.qyntra.app.CHAT_MARK_READ";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String peerId = intent.getStringExtra("peer_id");
        if (peerId == null || peerId.isEmpty()) return;
        if (ACTION_MARK_READ.equals(intent.getAction())) {
            ChatBubbleStore.postChatReceipt(context, peerId, "read");
            ChatBubbleStore.cancelNotification(context, peerId);
            ChatBubbleOverlay.hide(context, peerId);
        }
    }
}
