package org.sfa.asistencia

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.delay

fun localAlarmTest(context: Context): Boolean {
    if (Build.VERSION.SDK_INT >= 33 && context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return false
    val manager = context.getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel("sfa_remote", "Alertas remotas SFA", NotificationManager.IMPORTANCE_HIGH))
    if (!manager.areNotificationsEnabled() || manager.getNotificationChannel("sfa_remote").importance == NotificationManager.IMPORTANCE_NONE) return false
    manager.notify("local-test", 0, Notification.Builder(context, "sfa_remote").setSmallIcon(R.drawable.ic_sfa)
        .setContentTitle("Prueba local de alarma SFA").setContentText("No es una emergencia. Sonido y vibración según los ajustes de Android.")
        .setVisibility(Notification.VISIBILITY_PRIVATE).setAutoCancel(true).build())
    return true
}

@Composable
fun AlarmLab(busy: Boolean, canPush: Boolean, localTest: () -> Unit, remoteTest: () -> Unit) {
    var scenario by remember { mutableStateOf<String?>(null) }
    var elapsed by remember { mutableIntStateOf(0) }
    LaunchedEffect(scenario) { elapsed = 0; while (scenario != null) { delay(1000); elapsed++ } }
    SfaHeading("Pruebas de asistencia", "Sin cinturón y sin generar incidentes reales.")
    SfaBadge("Modo de demostración")
    SfaSection("Alarma de este celular", Icons.Outlined.NotificationsActive)
    Text("Notificación local. El sonido y la vibración dependen de los ajustes de Android.", style = MaterialTheme.typography.bodyMedium, color = SfaMuted)
    SfaButton("Probar alarma local", Icons.Outlined.NotificationsActive, localTest, !busy)
    HorizontalDivider(Modifier.padding(vertical = 6.dp), color = SfaBorder)
    SfaSection("Escenarios simulados", Icons.Outlined.Science)
    for ((name, icon) in listOf("Caída detectada" to Icons.Outlined.PersonOutline, "Solicitud SOS" to Icons.Outlined.Sos, "Salida de geocerca" to Icons.Outlined.LocationOn)) {
        SfaButton(name, icon, { scenario = name }, !busy, secondary = true)
    }
    HorizontalDivider(Modifier.padding(vertical = 6.dp), color = SfaBorder)
    SfaSection("Aviso remoto de prueba", Icons.Outlined.Cloud)
    Text("Solo a este celular. Requiere la PC emisora con internet y envíos activos. Una prueba por minuto.", style = MaterialTheme.typography.bodyMedium, color = SfaMuted)
    if (!canPush) Text("Pendiente: iniciar sesión, activar avisos y seleccionar un residente en Cuidar.", style = MaterialTheme.typography.bodySmall, color = SfaMuted)
    SfaButton("Enviar prueba por internet", Icons.Outlined.Send, remoteTest, !busy && canPush, secondary = true)
    scenario?.let { name -> AlertDialog(onDismissRequest = { scenario = null },
        icon = { Icon(Icons.Outlined.Science, null) }, title = { Text("Simulación · $name") },
        text = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("No es una emergencia real", fontWeight = FontWeight.Bold)
            Text("%02d:%02d".format(elapsed / 60, elapsed % 60), style = MaterialTheme.typography.headlineSmall)
            Text("Practica la respuesta del cuidador. Esta pantalla no confirma detección del sensor ni precisión GPS y no avisa a otros cuidadores.")
        } }, confirmButton = { Button(onClick = { scenario = null }) { Text("Confirmar atención simulada") } },
        dismissButton = { TextButton(onClick = { scenario = null }) { Text("Finalizar prueba") } }) }
}
