package org.sfa.asistencia

import android.Manifest
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Handler
import android.os.Looper
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.concurrent.atomic.AtomicBoolean

private class TestLease(val id: String, @Volatile var token: String)

@Composable
fun AdminGpsLab(api: NativeApi, residents: JSONArray, capabilities: Map<String, PersonCapabilities>, foreground: Boolean, selected: String, onSelect: (String) -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val activeScreen = remember { AtomicBoolean(true) }
    var consent by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var lease by remember { mutableStateOf<TestLease?>(null) }
    var fix by remember { mutableStateOf<Location?>(null) }
    var notice by remember { mutableStateOf("") }
    var confirmed by remember { mutableStateOf<String?>(null) }
    var confirmStart by remember { mutableStateOf(false) }
    val latestFix by rememberUpdatedState(fix)
    val currentForeground by rememberUpdatedState(foreground)
    DisposableEffect(Unit) { onDispose { activeScreen.set(false) } }
    LaunchedEffect(foreground, capabilities) {
        if (!foreground || capabilities[selected]?.adminTest != true) lease = null
    }
    DisposableEffect(lease?.id) {
        val current = lease
        onDispose {
            if (current != null) Thread({
                val closed = try {
                    api.rpc("sfa_admin_gps_test", current.token, JSONObject().put("p_session", current.id).put("p_sample", JSONObject.NULL).put("p_end", true)).getBoolean("active").not()
                } catch (_: Exception) { false }
                Handler(Looper.getMainLooper()).post {
                    if (activeScreen.get() && lease == null) notice = if (closed) "Prueba detenida y coordenadas de ensayo descartadas." else "Prueba detenida en este celular. Cierre remoto no confirmado; la sesión temporal vence a los 30 minutos."
                }
            }, "sfa-gps-test-close").start()
        }
    }
    DisposableEffect(lease?.id, foreground) {
        val manager = context.getSystemService(LocationManager::class.java)
        val listener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                val now = System.currentTimeMillis()
                if (location.hasAccuracy() && AdminGpsTestPolicy.validFix(location.time, now, location.accuracy.toDouble(), location.latitude, location.longitude)) fix = Location(location)
            }
        }
        if (lease != null && foreground) {
            try {
                for (provider in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
                    if (manager.isProviderEnabled(provider)) manager.requestLocationUpdates(provider, 10000L, 0f, listener, Looper.getMainLooper())
                }
            } catch (_: SecurityException) { notice = "Permiso GPS retirado. Prueba detenida."; lease = null }
        }
        onDispose { manager.removeUpdates(listener) }
    }
    LaunchedEffect(lease?.id) {
        val current = lease ?: return@LaunchedEffect
        var lastSent: Long? = null
        while (true) {
            val location = latestFix
            if (location != null && AdminGpsTestPolicy.shouldSend(lastSent, location.time)) {
                try {
                    val result = withContext(Dispatchers.IO) {
                        current.token = CloudGpsSession.token(api)
                        val sample = JSONObject().put("latitude", location.latitude).put("longitude", location.longitude)
                            .put("accuracy_m", location.accuracy.toDouble()).put("observed_at", Instant.ofEpochMilli(location.time).toString())
                        api.rpc("sfa_admin_gps_test", current.token, JSONObject().put("p_session", current.id).put("p_sample", sample).put("p_end", false))
                    }
                    check(result.getBoolean("simulated") && result.getBoolean("active"))
                    confirmed = result.getJSONObject("last_sample").getString("observed_at")
                    lastSent = location.time
                    notice = "Coordenada de PRUEBA recibida. Los monitores autorizados pueden verla en el mapa habitual."
                } catch (error: CancellationException) { throw error
                } catch (error: Exception) { notice = operationErrorMessage(error); lease = null }
            }
            delay(10000)
        }
    }
    fun begin() {
        if (busy || !consent || capabilities[selected]?.adminTest != true || !foreground) return
        busy = true; fix = null; confirmed = null
        scope.launch {
            try {
                val token = withContext(Dispatchers.IO) { CloudGpsSession.token(api) }
                val result = withContext(Dispatchers.IO) { api.rpc("sfa_begin_admin_gps_test", token, JSONObject().put("p_resident", selected).put("p_confirm", true)) }
                check(result.getBoolean("simulated") && result.getString("resident_id") == selected)
                if (!currentForeground) {
                    withContext(Dispatchers.IO) { api.rpc("sfa_admin_gps_test", token, JSONObject().put("p_session", result.getString("session_id")).put("p_sample", JSONObject.NULL).put("p_end", true)) }
                    notice = "Prueba cancelada al dejar la aplicación."; return@launch
                }
                lease = TestLease(result.getString("session_id"), token)
                notice = "Prueba GPS activa. Esperando una lectura nueva de este celular."
            } catch (error: CancellationException) { throw error
            } catch (error: Exception) { notice = operationErrorMessage(error)
            } finally { busy = false }
        }
    }
    val permission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { allowed ->
        if (allowed) begin() else notice = "La prueba necesita ubicación precisa. No se inició ningún envío."
    }
    if (confirmStart) AlertDialog(onDismissRequest = { confirmStart = false },
        title = { Text("Confirmar prueba de administrador") },
        text = { Text("Enviarás la ubicación de ESTE celular como punto de prueba de la ficha ${selected.take(8)}. Será visible en su mapa habitual y puede desplazar la última ubicación mostrada. No representa la ubicación real de la persona ni genera emergencias reales.") },
        confirmButton = { TextButton(onClick = {
            confirmStart = false
            if (context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) begin()
            else permission.launch(Manifest.permission.ACCESS_FINE_LOCATION)
        }) { Text("Aceptar: es una prueba") } },
        dismissButton = { TextButton(onClick = { confirmStart = false }) { Text("Cancelar") } })
    SfaSection("GPS de prueba en el mapa habitual", Icons.Outlined.Science)
    SfaBadge(if (lease != null) "PRUEBA · ubicación de este celular" else "Solo administrador")
    Text("El punto de este celular puede sustituir la última ubicación mostrada, siempre con aviso de PRUEBA. No borra GPS real ni cambia geocercas o incidentes. Se detiene al salir de esta pantalla.", style = MaterialTheme.typography.bodyMedium, color = SfaMuted)
    for (i in 0 until residents.length()) {
        val person = residents.getJSONObject(i); val id = person.getString("id")
        if (capabilities[id]?.adminTest == true) SfaChoice(person.getString("full_name"), "Referencia de ensayo · ${id.take(8)}", Icons.Outlined.PersonOutline, selected == id, lease == null && !busy) { onSelect(id); consent = false; confirmed = null }
    }
    Row { Checkbox(checked = consent, onCheckedChange = { consent = it }, enabled = lease == null && !busy); Text("Autorizo mostrar el GPS de este celular como PRUEBA en esta ficha, visible para sus monitores autorizados.", Modifier.weight(1f).padding(top = 10.dp), style = MaterialTheme.typography.bodyMedium) }
    if (lease == null) SfaButton("Iniciar prueba GPS", Icons.Outlined.PlayCircle, { confirmStart = true }, !busy && selected.isNotEmpty() && consent && foreground)
    else SfaButton("Detener y descartar prueba", Icons.Outlined.StopCircle, { lease = null; fix = null; confirmed = null }, danger = true)
    if (notice.isNotBlank()) Text(notice, style = MaterialTheme.typography.bodyMedium, color = SfaMuted)
    if (lease != null && confirmed != null) Text("Última lectura de prueba: $confirmed", style = MaterialTheme.typography.bodySmall, color = SfaMuted)
    HorizontalDivider(Modifier.padding(vertical = 12.dp), color = SfaBorder)
}
