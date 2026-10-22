package org.sfa.asistencia

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.*
import org.json.JSONObject

private data class PhoneIncident(val id: String, val type: String, val stamp: String, val simulated: Boolean,
    val actor: String?, val outcome: String?, val revision: String?)

@Composable fun IncidentFeed(resident: String, api: NativeApi) {
    key(resident) { IncidentWorkspace(resident, api) }
}

@Composable private fun IncidentWorkspace(resident: String, api: NativeApi) {
    var items by remember { mutableStateOf<List<PhoneIncident>>(emptyList()) }
    var viewer by remember { mutableStateOf("") }
    var canAttend by remember { mutableStateOf(false) }
    var fresh by remember { mutableStateOf(false) }
    var zone by remember { mutableStateOf<ZoneSituationStatus?>(null) }
    var closedExit by remember { mutableStateOf(false) }
    var clock by remember { mutableLongStateOf(System.currentTimeMillis()) }
    var warning by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var revision by remember { mutableIntStateOf(0) }
    var confirmation by remember { mutableStateOf<Pair<PhoneIncident, String>?>(null) }
    val scope = rememberCoroutineScope()
    LaunchedEffect(Unit) { while (isActive) { delay(1000); clock = System.currentTimeMillis() } }
    LaunchedEffect(resident, revision) {
        while (isActive) {
            try {
                val result = withContext(Dispatchers.IO) { api.rpc("sfa_incidents", CloudGpsSession.token(api), JSONObject().put("p_resident", resident)) }
                val list = result.getJSONArray("events")
                val all = (0 until list.length()).map { index ->
                    val event = list.getJSONObject(index)
                    PhoneIncident(event.getString("id"), event.getString("event_type"), event.getString("observed_at"), event.getBoolean("simulated"),
                        if (event.isNull("actor_id")) null else event.getString("actor_id"),
                        if (event.isNull("outcome")) null else event.getString("outcome"),
                        if (event.isNull("updated_at")) null else event.getString("updated_at"))
                }
                items = all.filter { it.outcome == null || it.outcome == "attending" }
                closedExit = items.none { !it.simulated && it.type == "GEOCERCA_SALIDA" } && all.any { !it.simulated && it.type == "GEOCERCA_SALIDA" && it.outcome in listOf("attended", "false_alarm") }
                zone = result.optJSONObject("zone_status")?.let { status -> ZoneSituationStatus(status.optString("state"), status.optString("last_confirmed"),
                    if (status.isNull("observed_at")) null else status.optString("observed_at")) }
                viewer = result.optString("viewer_id")
                canAttend = result.optBoolean("can_attend"); fresh = true; warning = ""
            } catch (error: CancellationException) { throw error
            } catch (error: Exception) {
                if (error is ApiFailure && (error.status == 401 || error.status == 403)) { items = emptyList(); zone = null }
                fresh = false; canAttend = false
                warning = "Sin actualización de incidentes. El último estado recibido no confirma la situación actual. Revisa sesión e internet."
            }
            delay(5000)
        }
    }
    fun attend(item: PhoneIncident, outcome: String) {
        if (busy || !fresh || !canAttend) return
        busy = true
        scope.launch {
            try {
                withContext(Dispatchers.IO) { api.rpc("sfa_attend_incident", CloudGpsSession.token(api), JSONObject()
                    .put("p_event", item.id).put("p_expected", item.revision ?: JSONObject.NULL).put("p_outcome", outcome)) }
            } catch (error: CancellationException) { throw error
            } catch (_: Exception) { warning = "No se confirmó el cambio. Se consultará el estado compartido." }
            finally { busy = false; confirmation = null; revision++ }
        }
    }
    SfaSection("Incidentes pendientes", Icons.Outlined.NotificationsActive)
    if (warning.isNotBlank()) Text(warning, color = SfaOrange, style = MaterialTheme.typography.bodySmall)
    zoneSituationNotice(zone, clock, fresh, closedExit)?.let { notice ->
        Surface(color = if (notice.warning) Color(0xFFFFF7ED) else Color(0xFFF8FAFC), shape = RoundedCornerShape(8.dp),
            border = BorderStroke(1.dp, if (notice.warning) SfaOrange else SfaBorder)) {
            Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(notice.title, color = if (notice.warning) Color(0xFF9A3412) else SfaMuted, fontWeight = FontWeight.Bold)
                Text(notice.detail, style = MaterialTheme.typography.bodyMedium)
            }
        }
    }
    if (items.any { !it.simulated }) Surface(color = Color(0xFFFFF7ED), shape = RoundedCornerShape(8.dp), border = BorderStroke(1.dp, Color(0xFFFDBA74))) {
        Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(if (items.any { !it.simulated && it.type == "GEOCERCA_SALIDA" }) "Salida de geocerca pendiente de atención" else "Asistencia pendiente", color = Color(0xFF9A3412), fontWeight = FontWeight.Bold)
            Text("Reingresar, perder señal o descartar la notificación no resuelve este incidente.", style = MaterialTheme.typography.bodyMedium)
        }
    }
    if (fresh && items.isEmpty()) Text("Sin incidentes pendientes para la persona seleccionada.", style = MaterialTheme.typography.bodySmall, color = SfaMuted)
    for (item in items) Column(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(if (item.simulated) "PRUEBA · No es una emergencia" else if (item.type == "GEOCERCA_SALIDA") "Salida de geocerca" else item.type.replace('_', ' '), fontWeight = FontWeight.SemiBold)
        Text(java.time.Instant.parse(item.stamp).atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("dd/MM · HH:mm:ss")), style = MaterialTheme.typography.bodySmall, color = SfaMuted)
        Text(if (item.outcome == null) "Pendiente de atención" else if (item.actor == viewer) "En atención por ti" else "En atención por otro cuidador", style = MaterialTheme.typography.bodyMedium)
        if (fresh && canAttend && item.outcome == null) SfaButton("Tomar atención", Icons.Outlined.PanTool, { attend(item, "attending") }, !busy)
        if (fresh && canAttend && item.outcome == "attending" && item.actor == viewer) {
            SfaButton("Atención realizada", Icons.Outlined.CheckCircleOutline, { confirmation = item to "attended" }, !busy)
            SfaButton("Falsa alarma", Icons.Outlined.Close, { confirmation = item to "false_alarm" }, !busy, secondary = true)
        }
        HorizontalDivider(color = SfaBorder)
    }
    confirmation?.let { (item, outcome) -> AlertDialog(onDismissRequest = { if (!busy) confirmation = null },
        title = { Text(if (outcome == "attended") "Confirmar atención realizada" else "Confirmar falsa alarma") },
        text = { Text("La resolución se compartirá con los cuidadores. El historial se conserva." +
            if (item.type == "GEOCERCA_SALIDA") " Cerrar la atención no confirma el reingreso: la advertencia de zona puede permanecer visible." else "") },
        confirmButton = { TextButton(enabled = !busy && fresh, onClick = { attend(item, outcome) }) { Text("Confirmar resolución") } },
        dismissButton = { TextButton(enabled = !busy, onClick = { confirmation = null }) { Text("Cancelar") } }) }
}
