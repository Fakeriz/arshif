package expo.modules.smartlog

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmartLogModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("React context tidak tersedia")

  override fun definition() = ModuleDefinition {
    Name("ArshifSmartLog")
    Events("onCapture")

    OnCreate { instance = this@SmartLogModule }
    OnDestroy { if (instance === this@SmartLogModule) instance = null }

    Function("hasPermission") {
      val flat = Settings.Secure.getString(context.contentResolver, "enabled_notification_listeners").orEmpty()
      flat.split(":").any { ComponentName.unflattenFromString(it)?.packageName == context.packageName }
    }

    Function("openPermissionSettings") {
      val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("configure") { enabled: Boolean, packages: List<String> ->
      CaptureStore(context).configure(enabled, packages)
    }

    /** JSON array tangkapan; antrean langsung dikosongkan (sekali pakai). */
    Function("drain") { CaptureStore(context).drain() }

    Function("pendingCount") { CaptureStore(context).count() }
  }

  companion object {
    @Volatile private var instance: SmartLogModule? = null

    fun notifyCaptured() {
      instance?.sendEvent("onCapture", emptyMap<String, Any>())
    }
  }
}
