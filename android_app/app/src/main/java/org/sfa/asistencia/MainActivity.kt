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
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.border
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.withContext
import org.json.JSONArray

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { SfaTheme { SfaScreen() } }
    }
    @OptIn(ExperimentalMaterial3Api::class)
    @Composable private fun SfaScreen() {
        val scope = rememberCoroutineScope()
        val state by PhoneRuntime.state.collectAsState()
        val api = remember { NativeApi(this) }
        val push = remember { PushRegistration(this) }
        var pushActive by remember { mutableStateOf(push.enabled) }
        var acceptsTests by remember { mutableStateOf(push.acceptsTests) }
        var confirmSos by remember { mutableStateOf<Boolean?>(null) }
        var sosNotice by remember { mutableStateOf("") }
        val bindingStore = remember { SecureBinding(this) }
        var binding by remember { mutableStateOf(bindingStore.load()) }
        var incoming by remember { mutableStateOf<PhoneBinding?>(null) }
        var importCa by remember { mutableStateOf(false) }
        var tab by remember { mutableIntStateOf(0) }
        var message by remember { mutableStateOf("") }
        var operationError by remember { mutableStateOf("") }
        var busy by remember { mutableStateOf(false) }
        var email by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }
        var jwt by remember { mutableStateOf<String?>(null) }
        var residents by remember { mutableStateOf(JSONArray()) }
        var events by remember { mutableStateOf(JSONArray()) }
        var selected by remember { mutableStateOf("") }
        var devices by remember { mutableStateOf<List<Pair<String, String>>>(emptyList()) }
        var belt by remember { mutableStateOf<String?>(null) }
        var remoteGps by remember { mutableStateOf(true) }
        var cloudDevice by remember { mutableStateOf<String?>(null) }
        var cloudPerson by remember { mutableStateOf("") }
        var cloudResident by remember { mutableStateOf("") }
        var gpsConsent by remember { mutableStateOf(false) }
        var positions by remember { mutableStateOf(JSONArray()) }
        var showBluetooth by remember { mutableStateOf(false) }
        var showPassword by remember { mutableStateOf(false) }
        var showTrackingHelp by remember { mutableStateOf(false) }
        LaunchedEffect(cloudDevice, jwt != null) { sosNotice = ""; confirmSos = null }
        val snackbar = remember { SnackbarHostState() }
        var clock by remember { mutableLongStateOf(System.currentTimeMillis()) }
        LaunchedEffect(Unit) { while (true) { delay(1000); clock = System.currentTimeMillis() } }
        LaunchedEffect(message) { if (message.isNotBlank()) { snackbar.showSnackbar(message); message = "" } }
        fun work(refreshSession: Boolean = true, block: suspend () -> Unit) {
            if (busy) return
            busy = true
            scope.launch { message = ""; operationError = ""; try {
                if (refreshSession && jwt != null) jwt = withContext(Dispatchers.IO) { CloudGpsSession.token(api) }
                block()
            } catch (error: CancellationException) { throw error
            } catch (error: Exception) { operationError = operationErrorMessage(error); message = operationError
            } finally { pushActive = push.enabled; acceptsTests = push.acceptsTests; busy = false } }
        }
        fun sendSos(simulated: Boolean) = work(refreshSession = false) {
            val device = cloudDevice ?: error("Selecciona la persona primero")
            withContext(Dispatchers.IO) { api.queueSos(device, simulated) }
            sosNotice = "Solicitud guardada en este celular; aún no se confirmó el registro remoto."
            jwt = withContext(Dispatchers.IO) { CloudGpsSession.token(api) }
            val sent = withContext(Dispatchers.IO) { api.flushSos(jwt!!, device) }
            sosNotice = if (sent > 0) "Registrado en Supabase. Esto no confirma recepción ni atención del cuidador." else "Sin solicitudes recientes pendientes."
            message = sosNotice
        }
        val pushPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { allowed ->
            if (allowed && jwt != null) work { push.update(jwt!!, true); pushActive = push.enabled; message = "Celular registrado para alertas remotas" }
            else message = "Activa el permiso de notificaciones para recibir avisos"
        }
        fun startTracking() {
            if (remoteGps && cloudDevice != null && !gpsConsent) { message = "Autoriza el envío de ubicación antes de iniciar"; return }
            val gpsReady = if (remoteGps) cloudDevice != null else binding != null
            if (!gpsReady && belt == null) { message = "Vincula un residente para compartir GPS. No necesitas cinturón."; return }
            val intent = Intent(this, TrackingService::class.java).putExtra("gps", gpsReady)
            if (remoteGps && gpsReady) intent.putExtra("cloud_device", cloudDevice)
            if (belt != null) intent.putExtra("bluetooth", belt)
            try { startForegroundService(intent) } catch (_: Exception) { message = "Android no permitió iniciar el servicio. Abre la app y revisa permisos." }
        }
        val trackingPermissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { grants ->
            val gpsReady = if (remoteGps) cloudDevice != null else binding != null
            val gpsAllowed = !gpsReady || checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
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
        confirmSos?.let { simulated -> AlertDialog(onDismissRequest = { confirmSos = null },
            title = { Text(if (simulated) "Enviar prueba SOS" else "Enviar solicitud SOS real") },
            text = { Text(if (simulated) "Se registrará como PRUEBA y solo enviará push a cuidadores que aceptaron pruebas. No es una emergencia." else "Se solicitará ayuda a los cuidadores autorizados de $cloudPerson. Sin confirmación remota, utiliza otro medio de contacto.") },
            confirmButton = { TextButton(enabled = !busy, onClick = { confirmSos = null; sendSos(simulated) }) { Text(if (simulated) "Enviar prueba" else "Enviar SOS real") } },
            dismissButton = { TextButton(onClick = { confirmSos = null }) { Text("Cancelar") } }) }
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
        Scaffold(containerColor = Color(0xFFF8FAFC), topBar = { Column { SfaBrand(); if (busy) LinearProgressIndicator(Modifier.fillMaxWidth()) } },
            snackbarHost = { SnackbarHost(snackbar) { data ->
                Snackbar(Modifier.padding(horizontal = 16.dp).border(1.dp, SfaBorder, RoundedCornerShape(8.dp)), shape = RoundedCornerShape(8.dp), containerColor = Color.White, contentColor = SfaInk) {
                    Text(data.visuals.message, style = MaterialTheme.typography.bodyMedium)
                }
            } }, bottomBar = {
                Column { HorizontalDivider(color = SfaBorder)
                    NavigationBar(containerColor = Color.White, tonalElevation = 0.dp) {
                        NavigationBarItem(selected = tab == 0, onClick = { tab = 0 }, label = { Text("Compartir") }, icon = { Icon(Icons.Outlined.LocationOn, null) })
                        NavigationBarItem(selected = tab == 1, onClick = { tab = 1 }, label = { Text("Cuidar") }, icon = { Icon(Icons.Outlined.FavoriteBorder, null) })
                        NavigationBarItem(selected = tab == 2, onClick = { tab = 2 }, label = { Text("Pruebas") }, icon = { Icon(Icons.Outlined.Science, null) })
                    }
                }
            }) { padding ->
            Box(Modifier.padding(padding).fillMaxSize().imePadding(), contentAlignment = Alignment.TopCenter) {
            Column(Modifier.widthIn(max = 640.dp).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
                if (operationError.isNotBlank()) {
                    Surface(color = Color(0xFFFFF7ED), shape = RoundedCornerShape(8.dp), border = BorderStroke(1.dp, Color(0xFFFED7AA))) {
                        Row(Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Icon(Icons.Outlined.Info, contentDescription = null, tint = Color(0xFF9A3412))
                            Text(operationError, Modifier.weight(1f), color = Color(0xFF9A3412), style = MaterialTheme.typography.bodyMedium)
                        }
                    }
                }
                val incidentResident = if (tab == 0) cloudResident else selected.ifEmpty { cloudResident }
                if (jwt != null && incidentResident.isNotEmpty()) IncidentFeed(incidentResident, api)
                if (tab == 0) {
                    SfaHeading("Comparte tu ubicación", "El cinturón es opcional para el seguimiento GPS.")
                    SfaSection("Conexión", Icons.Outlined.Wifi)
                    SfaChoice("Por internet", "Wi-Fi o datos móviles · sin red compartida", Icons.Outlined.Cloud, remoteGps, !state.running) { remoteGps = true }
                    SfaChoice("Solo red local", "Conexión directa a tu PC", Icons.Outlined.Computer, !remoteGps, !state.running) { remoteGps = false }
                    if (remoteGps) {
                        if (jwt == null) SfaButton("Iniciar sesión para vincular", Icons.Outlined.Login, { tab = 1 })
                        else {
                            SfaSection("Persona vinculada", Icons.Outlined.PersonOutline)
                            if (cloudDevice != null) SfaBadge("GPS vinculado a $cloudPerson", true)
                            Row(verticalAlignment = Alignment.Top) { Checkbox(checked = gpsConsent, onCheckedChange = { gpsConsent = it }, enabled = !state.running); Text("Autorizo compartir la ubicación de este celular con Supabase y mis cuidadores autorizados.", Modifier.weight(1f).padding(top = 10.dp), style = MaterialTheme.typography.bodyMedium, color = SfaMuted) }
                            for (i in 0 until residents.length()) {
                                val person = residents.getJSONObject(i)
                                SfaChoice(person.getString("full_name"), person.optString("room"), Icons.Outlined.PersonOutline,
                                    cloudDevice != null && cloudResident == person.getString("id"), !busy && !state.running && gpsConsent, onClick = { work {
                                    val result = withContext(Dispatchers.IO) { api.rpc("sfa_register_phone", jwt!!, org.json.JSONObject().put("p_resident", person.getString("id"))) }
                                    cloudDevice = result.getString("device_id"); cloudResident = person.getString("id"); cloudPerson = person.getString("full_name")
                                    message = "Ubicación vinculada a $cloudPerson. Puedes iniciar solo GPS."
                                } })
                            }
                        }
                    } else {
                        Text(if (binding == null) "Sin PC vinculada" else binding!!.origin, style = MaterialTheme.typography.bodyMedium, color = SfaMuted)
                        SfaButton("Importar certificado de la PC", Icons.Outlined.VerifiedUser, { importCa = true }, !busy && !state.running, secondary = true)
                        SfaButton("Escanear QR de vinculación", Icons.Outlined.QrCodeScanner, { scanner.launch(ScanOptions().setDesiredBarcodeFormats(ScanOptions.QR_CODE).setPrompt("Vínculo de ubicación SFA").setBeepEnabled(false).setOrientationLocked(false)) }, !busy && !state.running, secondary = true)
                    }
                    if (remoteGps && cloudDevice != null && jwt != null) {
                        SfaSection("Solicitar ayuda", Icons.Outlined.Sos)
                        SfaButton("Enviar SOS", Icons.Outlined.NotificationsActive, { confirmSos = false }, !busy, danger = true)
                        SfaButton("Probar SOS con mis cuidadores", Icons.Outlined.Science, { confirmSos = true }, !busy, secondary = true)
                        SfaButton("Reintentar SOS pendientes", Icons.Outlined.Refresh, { work {
                            val sent = withContext(Dispatchers.IO) { api.flushSos(jwt!!, cloudDevice!!) }
                            sosNotice = if (sent > 0) "Solicitudes registradas en Supabase; recepción del cuidador aún no confirmada." else "Sin solicitudes recientes pendientes."
                        } }, !busy, secondary = true)
                        if (sosNotice.isNotBlank()) Text(sosNotice, style = MaterialTheme.typography.bodyMedium, color = SfaMuted)
                    }
                    HorizontalDivider(Modifier.padding(vertical = 6.dp), color = SfaBorder)
                    SfaSection("Seguimiento", Icons.Outlined.MyLocation, trailing = { SfaBadge(if (state.running) "Activo" else "Detenido", state.running) })
                    Text(state.message, style = MaterialTheme.typography.bodyMedium, color = SfaMuted)
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        val freshFix = state.running && state.lastFix?.let { clock - it in -30000L..90000L } == true
                        SfaMetric("Precisión GPS", if (freshFix) state.accuracy?.let { "±${it.toInt()} m" } ?: "Sin lectura" else "Sin lectura reciente", Modifier.weight(1f))
                        SfaMetric("Zona de referencia", if (!freshFix) "Sin posición reciente" else when (state.zone) { "outside" -> "Fuera"; "inside" -> "Dentro"; "pending" -> "Confirmando"; "uncertain" -> "Incierta"; "imprecise" -> "GPS impreciso"; else -> state.zone }, Modifier.weight(1f))
                    }
                    Text(state.lastSent?.let { "Último envío: ${java.time.Instant.parse(it).atZone(java.time.ZoneId.systemDefault()).toLocalTime().withNano(0)}" } ?: "Sin envíos confirmados", style = MaterialTheme.typography.bodySmall, color = SfaMuted)
                    Text("Fuente: ${state.locationSource} · Lectura: ${state.lastFix?.let { "hace ${((clock - it).coerceAtLeast(0) / 1000)} s" } ?: "pendiente"}", style = MaterialTheme.typography.bodySmall, color = SfaMuted)
                    state.zoneRadius?.let { radius -> Text("Radio recibido: ${radius.toInt()} m. La precisión GPS no cambia al reducir el radio.", style = MaterialTheme.typography.bodySmall, color = SfaMuted) }
                    if ((state.accuracy ?: 0f) > 25f) Text("Para comprobar desplazamientos pequeños, revisa que SFA tenga ubicación precisa y prueba al aire libre. Con ±${state.accuracy?.toInt()} m no se puede confirmar un movimiento de 5 m.", style = MaterialTheme.typography.bodySmall, color = SfaOrange)
                    SfaButton(if (state.running) "Detener seguimiento" else "Iniciar seguimiento", if (state.running) Icons.Outlined.StopCircle else Icons.Outlined.PlayCircle, onClick = {
                        if (state.running) stopService(Intent(this@MainActivity, TrackingService::class.java)) else {
                            val permissions = mutableListOf<String>()
                            if ((remoteGps && cloudDevice != null) || (!remoteGps && binding != null)) permissions.addAll(listOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                            if (belt != null) permissions.add(Manifest.permission.BLUETOOTH_CONNECT)
                            if (Build.VERSION.SDK_INT >= 33) permissions.add(Manifest.permission.POST_NOTIFICATIONS)
                            if (permissions.isEmpty()) startTracking() else trackingPermissions.launch(permissions.toTypedArray())
                        }
                    }, enabled = !busy && (state.running || belt != null || if (remoteGps) cloudDevice != null && gpsConsent else binding != null), danger = state.running)
                    HorizontalDivider(Modifier.padding(top = 6.dp), color = SfaBorder)
                    TextButton(onClick = { showBluetooth = !showBluetooth }, modifier = Modifier.fillMaxWidth().heightIn(min = 48.dp), contentPadding = PaddingValues(0.dp)) {
                        Icon(Icons.Outlined.Bluetooth, null, Modifier.size(20.dp)); Spacer(Modifier.width(8.dp)); Text("Cinturón opcional", Modifier.weight(1f)); Icon(if (showBluetooth) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore, null)
                    }
                    if (showBluetooth) {
                        SfaButton("Buscar equipos emparejados", Icons.Outlined.Bluetooth, { bluetoothPermission.launch(Manifest.permission.BLUETOOTH_CONNECT) }, !state.running, secondary = true)
                        for ((name, address) in devices) SfaChoice(name, "Bluetooth", Icons.Outlined.Bluetooth, belt == address, !state.running) { belt = address }
                        if (belt != null && !state.running) SfaButton("Desvincular cinturón · solo GPS", Icons.Outlined.LinkOff, { belt = null }, secondary = true)
                        state.belt?.let { Text("${it.state.replace('_', ' ')} · ${it.acceleration?.let { value -> "$value g" } ?: "Evento"}", style = MaterialTheme.typography.bodyMedium) }
                    }
                    TextButton(onClick = { showTrackingHelp = !showTrackingHelp }, modifier = Modifier.heightIn(min = 48.dp)) { Icon(Icons.Outlined.Info, null, Modifier.size(18.dp)); Spacer(Modifier.width(8.dp)); Text("Sobre la continuidad del seguimiento") }
                    if (showTrackingHelp) Text(if (remoteGps) "La sesión se renueva mientras el proceso siga activo; al reiniciar debes iniciar sesión otra vez. Android puede detener el servicio por cierre forzado o restricciones de batería." else "El modo local necesita la misma red o hotspot que la PC. El GPS no depende del cinturón.", style = MaterialTheme.typography.bodyMedium, color = SfaMuted)
                } else if (tab == 2) {
                    if (jwt != null && pushActive) Row(verticalAlignment = Alignment.Top) {
                        Checkbox(checked = acceptsTests, enabled = !busy, onCheckedChange = { enabled -> work { push.consentTests(jwt!!, enabled); message = if (enabled) "Este celular acepta pruebas de cuidadores autorizados" else "Recepción de pruebas desactivada" } })
                        Text("Aceptar pruebas SOS de las personas a mi cuidado en este celular", Modifier.weight(1f).padding(top = 10.dp), style = MaterialTheme.typography.bodyMedium)
                    }
                    AlarmLab(busy, jwt != null && selected.isNotEmpty() && pushActive,
                        localTest = { message = if (localAlarmTest(this@MainActivity)) "Prueba local publicada. Revisa la bandeja de notificaciones; el sonido depende de Android." else "Activa las notificaciones de SFA y su canal de alertas en Ajustes de Android." },
                        remoteTest = { work { push.test(jwt!!, selected); message = "Prueba en cola para este celular. Esperando a la PC emisora; esto todavía no confirma recepción." } })
                } else {
                    SfaHeading(if (jwt == null) "Tu espacio de cuidado" else "Personas a tu cuidado", if (jwt == null) "Acceso privado para personas autorizadas." else "Ubicación, eventos y avisos del celular.")
                    if (jwt == null) {
                        OutlinedTextField(value = email, onValueChange = { email = it }, label = { Text("Correo electrónico") }, leadingIcon = { Icon(Icons.Outlined.MailOutline, null) }, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email), singleLine = true, modifier = Modifier.fillMaxWidth(), enabled = !busy)
                        OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text("Contraseña") }, leadingIcon = { Icon(Icons.Outlined.Lock, null) }, trailingIcon = { IconButton(onClick = { showPassword = !showPassword }) { Icon(if (showPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, if (showPassword) "Ocultar contraseña" else "Mostrar contraseña") } }, visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password), singleLine = true, modifier = Modifier.fillMaxWidth(), enabled = !busy)
                        SfaButton("Iniciar sesión", Icons.Outlined.Login, onClick = { val enteredPassword = password; password = ""; work {
                            val result = withContext(Dispatchers.IO) { val token = api.login(email.trim(), enteredPassword); token to api.remoteResidents(token) }
                            jwt = result.first; residents = result.second; message = "Sesión verificada; acceso limitado por Supabase"
                        } }, enabled = !busy && !state.running && email.isNotBlank() && password.isNotBlank())
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Icon(Icons.Outlined.VerifiedUser, null, Modifier.size(16.dp), tint = SfaMuted); Text("Sin registro público. Tus permisos determinan qué residentes puedes consultar.", style = MaterialTheme.typography.bodySmall, color = SfaMuted) }
                    } else {
                        SfaSection("Alertas en este celular", Icons.Outlined.Notifications, trailing = { SfaBadge(if (pushActive && !push.renewalPending) "Registrado" else "Pendiente", pushActive && !push.renewalPending) })
                        Text(if (!push.configured) "Esta compilación no incluye configuración Firebase" else if (pushActive && push.renewalPending) "El registro necesita actualizarse" else if (pushActive) "Registro activo. La recepción depende del emisor y de los permisos de Android." else "Los avisos están desactivados en este celular.", style = MaterialTheme.typography.bodyMedium, color = SfaMuted)
                        SfaButton(if (pushActive && !push.renewalPending) "Desactivar avisos" else "Activar o actualizar avisos", Icons.Outlined.Notifications, onClick = {
                            if (pushActive && !push.renewalPending) work { push.update(jwt!!, false); pushActive = push.enabled; message = "Avisos desactivados" }
                            else if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) pushPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                            else work { push.update(jwt!!, true); pushActive = push.enabled; message = "Celular registrado para alertas remotas" }
                        }, enabled = !busy && push.configured, secondary = pushActive && !push.renewalPending)
                        HorizontalDivider(Modifier.padding(vertical = 6.dp), color = SfaBorder)
                        SfaSection("Residentes", Icons.Outlined.PeopleOutline, trailing = { SfaBadge(residents.length().toString()) })
                        if (residents.length() == 0) Text("No hay residentes autorizados para esta cuenta.", style = MaterialTheme.typography.bodyMedium, color = SfaMuted)
                        for (i in 0 until residents.length()) {
                            val resident = residents.getJSONObject(i)
                            SfaChoice(resident.getString("full_name"), resident.optString("room"), Icons.Outlined.PersonOutline, selected == resident.getString("id"), !busy) { val residentId = resident.getString("id"); selected = residentId; positions = JSONArray(); events = JSONArray(); work { val result = withContext(Dispatchers.IO) { api.remoteEvents(jwt!!, residentId) to api.remotePositions(jwt!!, residentId) }; if (selected == residentId) { events = result.first; positions = result.second } } }
                        }
                        if (selected.isNotEmpty()) SfaButton("Actualizar ubicación y eventos", Icons.Outlined.Refresh, { work { val result = withContext(Dispatchers.IO) { api.remoteEvents(jwt!!, selected) to api.remotePositions(jwt!!, selected) }; events = result.first; positions = result.second } }, !busy, secondary = true)
                        if (selected.isNotEmpty()) SfaSection("Última ubicación", Icons.Outlined.LocationOn)
                        if (positions.length() > 0) {
                            val position = positions.getJSONObject(0)
                            val stamp = java.time.Instant.parse(position.getString("observed_at"))
                            val age = (clock - stamp.toEpochMilli()) / 1000L
                            Text(if (age in 0..90) "Ubicación reciente · ±${position.getDouble("accuracy_m").toInt()} m" else "Ubicación histórica · no confirma la posición actual", fontWeight = FontWeight.SemiBold)
                            Text(stamp.atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy · HH:mm:ss")), style = MaterialTheme.typography.bodySmall, color = SfaMuted)
                            SfaButton("Ver ubicación en mapa", Icons.Outlined.Map, { try { startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse("geo:${position.getDouble("latitude")},${position.getDouble("longitude")}?q=${position.getDouble("latitude")},${position.getDouble("longitude")}"))) } catch (_: android.content.ActivityNotFoundException) { message = "No se encontró una aplicación de mapas instalada" } }, secondary = true)
                        } else if (selected.isNotEmpty()) Text("Sin ubicación recibida para este residente", style = MaterialTheme.typography.bodyMedium, color = SfaMuted)
                        if (selected.isNotEmpty()) SfaSection("Eventos recientes", Icons.Outlined.History)
                        if (selected.isNotEmpty() && events.length() == 0) Text("Sin eventos recibidos", style = MaterialTheme.typography.bodyMedium, color = SfaMuted)
                        for (i in 0 until events.length()) {
                            val event = events.getJSONObject(i)
                            Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                                Icon(if (event.optBoolean("simulated")) Icons.Outlined.Science else Icons.Outlined.Notifications, null, Modifier.padding(top = 2.dp).size(20.dp), tint = if (event.optBoolean("simulated")) SfaMuted else SfaOrange)
                                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                                    Text(event.getString("event_type").replace('_', ' ').lowercase().replaceFirstChar { it.uppercase() }, style = MaterialTheme.typography.labelLarge)
                                    if (event.optBoolean("simulated")) Text("Prueba · no es una emergencia", style = MaterialTheme.typography.bodySmall, color = SfaMuted)
                                    Text(java.time.Instant.parse(event.getString("observed_at")).atZone(java.time.ZoneId.systemDefault()).format(java.time.format.DateTimeFormatter.ofPattern("dd/MM · HH:mm")), style = MaterialTheme.typography.bodySmall, color = SfaMuted)
                                }
                            }
                            HorizontalDivider(color = SfaBorder)
                        }
                        SfaButton("Cerrar sesión", Icons.Outlined.Logout, onClick = { work {
                            if (pushActive) { push.update(jwt!!, false); pushActive = false }
                            stopService(Intent(this@MainActivity, TrackingService::class.java))
                            CloudGpsSession.clear(); cloudDevice = null; cloudResident = ""; gpsConsent = false
                            jwt = null; residents = JSONArray(); events = JSONArray(); positions = JSONArray(); selected = ""
                        } }, enabled = !busy, secondary = true)
                    }
                }
            }
            }
        }
    }
}
