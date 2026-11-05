package expo.modules.smartlog

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

/**
 * Antrean notifikasi yang ditangkap, disimpan di SharedPreferences supaya tetap ada saat aplikasi tertutup.
 * Aplikasi menguras antrean (baca + kosongkan sekaligus) lalu memprosesnya; tiap notifikasi diproses sekali.
 */
class CaptureStore(context: Context) {
  private val prefs = context.applicationContext.getSharedPreferences("arshif_smartlog", Context.MODE_PRIVATE)

  fun configure(enabled: Boolean, packages: List<String>) {
    synchronized(LOCK) {
      val edit = prefs.edit().putBoolean(KEY_ENABLED, enabled).putStringSet(KEY_PACKAGES, packages.toSet())
      if (!enabled) edit.remove(KEY_QUEUE)
      edit.apply()
    }
  }

  fun accepts(pkg: String): Boolean =
    prefs.getBoolean(KEY_ENABLED, false) && (prefs.getStringSet(KEY_PACKAGES, emptySet())?.contains(pkg) == true)

  /** false = notifikasi yang sama (kunci dan teks) sudah ada di antrean, mis. notifikasi diperbarui. */
  fun append(capture: JSONObject): Boolean {
    synchronized(LOCK) {
      val queue = read()
      for (i in 0 until queue.length()) {
        val old = queue.optJSONObject(i) ?: continue
        if (old.optString("key") == capture.optString("key") && old.optString("text") == capture.optString("text")) return false
      }
      queue.put(capture)
      val trimmed = JSONArray()
      val start = maxOf(0, queue.length() - MAX_QUEUE)
      for (i in start until queue.length()) trimmed.put(queue.get(i))
      prefs.edit().putString(KEY_QUEUE, trimmed.toString()).commit()
      return true
    }
  }

  fun drain(): String {
    synchronized(LOCK) {
      val json = read().toString()
      prefs.edit().remove(KEY_QUEUE).commit()
      return json
    }
  }

  fun count(): Int {
    synchronized(LOCK) {
      return read().length()
    }
  }

  private fun read(): JSONArray = try {
    JSONArray(prefs.getString(KEY_QUEUE, "[]"))
  } catch (_: Exception) {
    JSONArray()
  }

  companion object {
    private val LOCK = Any()
    private const val KEY_ENABLED = "enabled"
    private const val KEY_PACKAGES = "packages"
    private const val KEY_QUEUE = "queue"
    private const val MAX_QUEUE = 300
  }
}
