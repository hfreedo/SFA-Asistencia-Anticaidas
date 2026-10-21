package org.sfa.asistencia

import android.Manifest
import android.app.Activity
import android.bluetooth.BluetoothManager
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MaterialTheme(colorScheme = lightColorScheme(primary = Color(0xFF0D9488), secondary = Color(0xFF10B981), background = Color(0xFFF8FAFC), surface = Color.White, error = Color(0xFFEA580C))) { SfaScreen() } }
    }
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable private fun SfaScreen() {
        val scope = rememberCoroutineScope()
        val state by PhoneRuntime.state.collectAsState()
        val api = remember { NativeApi(this) }
        val push = remember { PushRegistration(this) }
        var pushActive by remember { mutableStateOf(push.enabled) }
        val bindingStore = remember { SecureBinding(this) }
        var binding by remember { mutableStateOf(bindingStore.load()) }
        var incoming by remember { mutableStateOf<PhoneBinding?>(null) }
        var importCa by remember { mutableStateOf(false) }
        var tab by remember { mutableIntStateOf(0) }
        var message by remember { mutableStateOf("") }
        var busy by remember { mutableStateOf(false) }
        var email by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
        var jwt by remember { mutableStateOf<String?>(null) }
        var residents by remember { mutableStateOf(JSONArray()) }
        var events by remember { mutableStateOf(JSONArray()) }
        var selected by remember { mutableStateOf("") }
        var devices by remember { mutableStateOf<List<Pair<String, String>>>(emptyList()) }
        var belt by remember { mutableStateOf<String?>(null) }
        fun work(block: suspend () -> Unit) {
            if (busy) return
            busy = true
            scope.launch { message = ""; try { block() } catch (_: Exception) { message = "No se pudo completar la operación. Revisa permisos, certificado, sesión y conexión." } finally { pushActive = push.enabled; busy = false } }
        }
        val pushPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { allowed ->
            if (allowed && jwt != null) work { push.update(jwt!!, true); pushActive = push.enabled; message = "Celular registrado para alertas remotas" }
            else message = "Activa el permiso de notificaciones para recibir avisos"
        }
        fun startTracking() {
            if (binding == null && belt == null) { message = "Vincula la PC o selecciona un cinturón"; return }
            val intent = Intent(this, TrackingService::class.java).putExtra("gps", binding != null)
            if (belt != null) intent.putExtra("bluetooth", belt)
            try { startForegroundService(intent) } catch (_: Exception) { message = "Android no permitió iniciar el servicio. Abre la app y revisa permisos." }
        }
        val trackingPermissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
            val gpsAllowed = binding == null || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
            val btAllowed = belt == null || checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
            if (gpsAllowed && btAllowed) startTracking() else message = "Se requieren los permisos del modo seleccionado"
            if (Build.VERSION.SDK_INT >= 33 && grants[Manifest.permission.POST_NOTIFICATIONS] == false) message = "Avisos bloqueados por el permiso de notificaciones"
        }
        val bluetoothPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { allowed ->
            if (allowed) {
                try { devices = getSystemService(BluetoothManager::class.java).adapter?.bondedDevices?.map { (it.name ?: "Dispositivo") to it.address } ?: emptyList() }
                catch (_: SecurityException) { message = "No se pudo leer los equipos vinculados" }
            } else message = "Permiso Bluetooth denegado"
        }
        val scanner = rememberLauncherForActivityResult(ScanContract()) { result ->
            if (result.contents != null) {
                try { incoming = PhoneBinding.parse(result.contents) }
                catch (_: Exception) { message = "El QR no es un vínculo HTTPS de ubicación de SFA" }
            }
        }
        val certificate = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
            if (uri != null) work {
                withContext(Dispatchers.IO) { contentResolver.openInputStream(uri)!!.use { stream -> api.installCa(readLimited(stream, 32768)) } }
                message = "CA importada solo para SFA. Verifica que provenga de tu PC."
            }
        }
        incoming?.let { candidate ->
            AlertDialog(onDismissRequest = { incoming = null }, title = { Text("Vincular esta PC") },
                text = { Text("${candidate.origin}\nEl GPS se enviará a esta PC al iniciar. Los registros pendientes del vínculo anterior no se reasignan.") },
                confirmButton = { TextButton(onClick = { work {
                    stopService(Intent(this, TrackingService::class.java))
                    withContext(Dispatchers.IO) { api.deviceContext(candidate); bindingStore.save(candidate) }
                    binding = candidate; incoming = null; message = "PC vinculada"
                } }) { Text("Confirmar vínculo") } }, dismissButton = { TextButton(onClick = { incoming = null }) { Text("Cancelar") } })
        }
        if (importCa) AlertDialog(onDismissRequest = { importCa = false }, title = { Text("Confiar en la CA de tu PC") },
            text = { Text("Selecciona SFA_Asistencia_CA.cer de tu PC de confianza. Solo esta app lo usará para validar el servidor local; no cambia la confianza global de Android.") },
            confirmButton = { TextButton(onClick = { importCa = false; certificate.launch(arrayOf("*/*")) }) { Text("Seleccionar certificado") } },
            dismissButton = { TextButton(onClick = { importCa = false }) { Text("Cancelar") } })
        Scaffold(containerColor = Color(0xFFF8FAFC), topBar = {
            TopAppBar(title = { Column { Text("SFA Asistencia", fontWeight = FontWeight.Bold); Text("Cuidado y monitoreo", fontSize = 12.sp) } }, navigationIcon = { Image(painterResource(R.drawable.logo_sfa), "Logo SFA", Modifier.padding(8.dp).size(42.dp)) })
        }) { padding ->
            Column(Modifier.padding(padding).fillMaxSize().verticalScroll(rememberScrollState()).padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                TabRow(selectedTabIndex = tab) {
                    Tab(selected = tab == 0, onClick = { tab = 0 }, text = { Text("Compartir") }, icon = { Icon(Icons.Outlined.LocationOn, null) })
                    Tab(selected = tab == 1, onClick = { tab = 1 }, text = { Text("Cuidar") }, icon = { Icon(Icons.Outlined.FavoriteBorder, null) })
                }
                if (message.isNotBlank()) Text(message, color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyMedium)
                if (tab == 0) {
                    Text("Esta persona comparte", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    Text(if (binding == null) "Sin PC vinculada" else binding!!.origin, style = MaterialTheme.typography.bodyMedium)
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { importCa = true }, enabled = !busy && !state.running) { Icon(Icons.Outlined.VerifiedUser, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("Certificado") }
                        Button(onClick = { scanner.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("Vínculo de ubicación SFA").setBeepEnabled(false).setOrientationLocked(false)) }, enabled = !busy && !state.running) { Icon(Icons.Outlined.QrCodeScanner, null, Modifier.size(18.dp)); Spacer(Modifier.width(6.dp)); Text("Escanear QR") }
                    }
                    HorizontalDivider()
                    Text(if (state.running) "Seguimiento activo" else "Seguimiento detenido", fontWeight = FontWeight.Bold, color = MaterialTheme.colorScheme.primary)
                    Text(state.message)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("Precisión GPS"); Text(state.accuracy?.let { "±${it.toInt()} m" } ?: "Sin lectura") }
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("Zona"); Text(when (state.zone) { "outside" -> "Fuera"; "inside" -> "Dentro"; "pending" -> "Confirmando"; "uncertain" -> "Límite incierto"; "imprecise" -> "Precisión insuficiente"; else -> state.zone }) }
                    Text(state.lastSent?.let { "Último envío: $it" } ?: "Sin envíos confirmados", style = MaterialTheme.typography.bodySmall)
                    Text("Cinturón Bluetooth", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                    OutlinedButton(onClick = { bluetoothPermission.launch(Manifest.permission.BLUETOOTH_CONNECT) }, enabled = !state.running) { Icon(Icons.Outlined.Bluetooth, null); Text("Equipos emparejados") }
                    for ((name, address) in devices) Row { RadioButton(selected = belt == address, onClick = { belt = address }, enabled = !state.running); Text(name, Modifier.padding(top = 12.dp)) }
                    if (belt != null && !state.running) TextButton(onClick = { belt = null }) { Text("Solo GPS, sin cinturón") }
                    state.belt?.let { Text("${it.state.replace('_', ' ')} · ${it.acceleration?.let { value -> "$value g" } ?: "Evento"}", fontWeight = FontWeight.Medium) }
                    Button(modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp), onClick = {
                        if (state.running) stopService(Intent(this@MainActivity, TrackingService::class.java)) else {
                            val permissions = mutableListOf<String>()
                            if (binding != null) permissions.addAll(listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                            if (belt != null) permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
                            if (Build.VERSION.SDK_INT >= 33) permissions.add(Manifest.permission.POST_NOTIFICATIONS)
                            if (permissions.isEmpty()) startTracking() else trackingPermissions.launch(permissions.toTypedArray())
                        }
                    }, enabled = !busy) { Icon(if (state.running) Icons.Outlined.StopCircle else Icons.Outlined.PlayCircle, null); Spacer(Modifier.width(8.dp)); Text(if (state.running) "Detener seguimiento" else "Iniciar seguimiento") }
                    Text("GPS hacia la PC: misma red o hotspot. El servicio mantiene una notificación visible. Android puede detenerlo si fuerzas el cierre o restringes la batería.", style = MaterialTheme.typography.bodySmall)
                } else {
                    Text("Monitoreo remoto", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold)
                    if (jwt == null) {
                        OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Correo") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text("Contraseña") }, visualTransformation = PasswordVisualTransformation(), singleLine = true, modifier = Modifier.fillMaxWidth())
                        Button(onClick = { val enteredPassword = password; password = ""; work {
                            val result = withContext(Dispatchers.IO) { val token = api.login(email.trim(), enteredPassword); token to api.remoteResidents(token) }
                            jwt = result.first; residents = result.second; message = "Sesión verificada; acceso limitado por Supabase"
                        } }, enabled = !busy && email.isNotBlank() && password.isNotBlank()) { Text("Iniciar sesión") }
                    } else {
                        Text("Alertas en este celular", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold)
                        Text(if (!push.configured) "Esta compilación no incluye configuración Firebase" else if (pushActive && push.renewalPending) "El registro necesita actualizarse" else if (pushActive) "Registro activo; el servidor debe estar configurado" else "Desactivadas")
                        Button(onClick = {
                            if (pushActive && !push.renewalPending) work { push.update(jwt!!, false); pushActive = push.enabled; message = "Avisos desactivados" }
                            else if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) pushPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                            else work { push.update(jwt!!, true); pushActive = push.enabled; message = "Celular registrado para alertas remotas" }
                        }, enabled = !busy && push.configured) { Icon(Icons.Outlined.Notifications, null); Spacer(Modifier.width(8.dp)); Text(if (pushActive && !push.renewalPending) "Desactivar avisos" else "Activar o actualizar avisos") }
                        Text("Residentes autorizados: ${residents.length()}")
                        for (i in 0 until residents.length()) {
                            val resident = residents.getJSONObject(i)
                            OutlinedButton(onClick = { val residentId = resident.getString("id"); selected = residentId; work { val result = withContext(Dispatchers.IO) { api.remoteEvents(jwt!!, residentId) }; if (selected == residentId) events = result } }, modifier = Modifier.fillMaxWidth(), enabled = !busy) { Text(resident.getString("full_name") + " · " + resident.optString("room")) }
                        }
                        if (selected.isNotEmpty()) TextButton(onClick = { work { events = withContext(Dispatchers.IO) { api.remoteEvents(jwt!!, selected) } } }, enabled = !busy) { Icon(Icons.Outlined.Refresh, null); Text("Actualizar eventos") }
                        for (i in 0 until events.length()) { val event = events.getJSONObject(i); Text("${if (event.optBoolean("simulated")) "Simulado · " else ""}${event.getString("event_type").replace('_', ' ')}\n${event.getString("observed_at")}"); HorizontalDivider() }
                        TextButton(onClick = { work {
                            if (pushActive) { push.update(jwt!!, false); pushActive = false }
                            jwt = null; residents = JSONArray(); events = JSONArray(); selected = ""
                        } }, enabled = !busy) { Text("Cerrar sesión") }
                        Text("Los avisos requieren permiso, internet y emisor configurado. Si Android fuerza la detención no se garantiza su recepción. GPS hacia Supabase sigue pendiente.", style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
        }
    }
}
