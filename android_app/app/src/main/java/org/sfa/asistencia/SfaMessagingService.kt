package org.sfa.asistencia

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

class SfaMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        // No JWT is persisted. Register a renewed token only from a signed-in screen.
        getSharedPreferences("push", Context.MODE_PRIVATE).edit().putBoolean("renewal_pending", true).apply()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val preferences = getSharedPreferences("push", Context.MODE_PRIVATE)
        if (!preferences.getBoolean("enabled", false)) return
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        val event = PushEnvelope.eventId(message.data, System.currentTimeMillis()) ?: return
        val seen = preferences.getString("seen", "")!!.split(',').filter { it.isNotEmpty() }
        if (event in seen) return
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("sfa_remote", "Alertas remotas SFA", NotificationManager.IMPORTANCE_HIGH))
        if (!manager.areNotificationsEnabled()) return
        val open = PendingIntent.getActivity(this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val test = message.data["is_test"] == "true"
        val notification = android.app.Notification.Builder(this, "sfa_remote")
            .setSmallIcon(R.drawable.ic_sfa)
            .setContentTitle(if (test) "Prueba de aviso remoto SFA" else "Alerta de SFA Asistencia")
            .setContentText(if (test) "Prueba recibida. No es una emergencia." else "Hay un evento que requiere atención. Abre SFA para revisarlo.")
            .setVisibility(android.app.Notification.VISIBILITY_PRIVATE)
            .setContentIntent(open).setAutoCancel(true).build()
        manager.notify(event, 0, notification)
        preferences.edit().putString("seen", (seen.takeLast(49) + event).joinToString(",")).apply()
    }
}
