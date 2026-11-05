package expo.modules.smartlog

import android.app.Notification
import android.content.ComponentName
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import org.json.JSONObject

/** Menangkap notifikasi dari aplikasi bank yang ditautkan pengguna. Isi notifikasi lain tidak dibaca. */
class SmartLogListenerService : NotificationListenerService() {
  override fun onNotificationPosted(sbn: StatusBarNotification) {
    val store = CaptureStore(applicationContext)
    if (!store.accepts(sbn.packageName)) return
    val notification = sbn.notification ?: return
    // Ringkasan grup hanya mengulang notifikasi anaknya.
    if (notification.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
    val extras = notification.extras ?: return
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
    val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString().orEmpty()
    if (title.isBlank() && text.isBlank()) return

    val capture = JSONObject()
      .put("key", "${sbn.key}|${sbn.postTime}".take(200))
      .put("pkg", sbn.packageName)
      .put("title", title.take(200))
      .put("text", text.take(1000))
      .put("postedAt", sbn.postTime)
    if (store.append(capture)) SmartLogModule.notifyCaptured()
  }

  override fun onListenerDisconnected() {
    // Beberapa ROM (termasuk MIUI) memutus listener; minta sambung ulang.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      NotificationListenerService.requestRebind(ComponentName(this, SmartLogListenerService::class.java))
    }
  }
}
