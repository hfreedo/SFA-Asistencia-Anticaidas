package org.sfa.asistencia

import android.Manifest
import android.app.*
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.IBinder
import android.os.Looper
import kotlinx.coroutines.flow.MutableStateFlow
import org.json.JSONObject
import java.time.Instant
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit

data class PhoneState(val running: Boolean = false, val message: String = "Seguimiento detenido", val accuracy: Float? = null,
                      val lastSent: String? = null, val belt: BeltReading? = null, val zone: String = "Sin evaluación", val lastFix: Long? = null)
object PhoneRuntime { val state = MutableStateFlow(PhoneState()) }

class TrackingService : Service(), LocationListener {
    private val executor = Executors.newSingleThreadScheduledExecutor()
    private lateinit var database: LocationOutbox
    private lateinit var api: NativeApi
    private var binding: PhoneBinding? = null
    private var cloudDevice: String? = null
    private val linkId get() = cloudDevice?.let { "cloud:$it" } ?: binding?.id
    private var bluetooth: BluetoothSocket? = null
    private val engine = GeofenceEngine()
    @Volatile private var fence: JSONObject? = null
    @Volatile private var closing = false
    private var refreshCounter = 0
    private var lastBeltAlert = ""
    private fun state(transform: (PhoneState) -> PhoneState) { PhoneRuntime.state.value = transform(PhoneRuntime.state.value) }
    override fun onCreate() {
        super.onCreate()
        database = LocationOutbox(this); api = NativeApi(this)
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("tracking", "Seguimiento activo", NotificationManager.IMPORTANCE_LOW))
        manager.createNotificationChannel(NotificationChannel("alerts", "Alertas de asistencia", NotificationManager.IMPORTANCE_HIGH))
    }
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == "STOP") { stopSelf(); return START_NOT_STICKY }
        if (PhoneRuntime.state.value.running) return START_NOT_STICKY
        val gps = intent?.getBooleanExtra("gps", true) ?: true
        val address = intent?.getStringExtra("bluetooth")
        cloudDevice = intent?.getStringExtra("cloud_device")
        if (gps && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) { stopSelf(); return START_NOT_STICKY }
        if (address != null && checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) { stopSelf(); return START_NOT_STICKY }
        val stop = PendingIntent.getService(this, 2, Intent(this, TrackingService::class.java).setAction("STOP"), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val open = PendingIntent.getActivity(this, 1, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val notification = Notification.Builder(this, "tracking").setSmallIcon(R.drawable.ic_sfa).setContentTitle("SFA Asistencia")
            .setContentText(if (gps && cloudDevice != null) "Ubicación remota activa por internet" else if (gps) "Ubicación activa hacia la PC vinculada" else "Cinturón Bluetooth activo")
            .setOngoing(true).setContentIntent(open).addAction(Notification.Action.Builder(null, "Detener", stop).build()).build()
        val type = (if (gps) ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION else 0) or (if (address != null) ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE else 0)
        startForeground(1, notification, type)
        binding = SecureBinding(this).load()
        PhoneRuntime.state.value = PhoneState(running = true, message = "Servicio activo; esperando lecturas")
        if (gps) {
            if (linkId == null) { state { it.copy(message = "Falta vincular un destino") }; stopSelf(); return START_NOT_STICKY }
            val cache = filesDir.resolve("zone.json")
            try { val saved = JSONObject(cache.readText()); if (saved.optString("binding") == linkId) fence = saved.optJSONObject("geofence") } catch (_: Exception) { }
            val manager = getSystemService(LocationManager::class.java)
            try {
                for (provider in listOf(LocationManager.GPS_PROVIDER, LocationManager.NETWORK_PROVIDER)) {
                    if (manager.isProviderEnabled(provider)) manager.requestLocationUpdates(provider, 10000, 0f, this, Looper.getMainLooper())
                }
            } catch (_: SecurityException) { state { it.copy(message = "Permiso de ubicación retirado") }; stopSelf() }
            executor.scheduleWithFixedDelay({ synchronize() }, 0, 10, TimeUnit.SECONDS)
        }
        if (address != null) connectBelt(address)
        return START_NOT_STICKY
    }
    private fun synchronize() {
        if (closing) return
        val idBinding = linkId ?: return
        try {
            val cloud = cloudDevice
            val token = if (cloud != null) CloudGpsSession.token(api) else null
            if (refreshCounter++ % 3 == 0) {
                val context = if (cloud != null) api.rpc("sfa_phone_context", token!!, JSONObject().put("p_device", cloud)) else api.deviceContext(binding!!)
                val updated = context.optJSONObject("geofence")
                if (fence?.toString() != updated.toString()) engine.reset()
                fence = updated
                filesDir.resolve("zone.json").writeText(JSONObject().put("binding", idBinding).put("geofence", updated ?: JSONObject.NULL).toString())
            }
            for ((id, observed, payload) in database.pending(idBinding)) {
                if (closing) break
                if (System.currentTimeMillis() - observed > 90000) { database.mark(id, "historical"); continue }
                try {
                    if (cloud != null) {
                        val result = api.rpc("sfa_ingest_phone", token!!, JSONObject().put("p_device", cloud).put("p_id", id).put("p_sample", JSONObject(payload)))
                        check(result.optString("accepted") == id)
                    } else api.position(binding!!, payload)
                    database.mark(id, "sent")
                    state { it.copy(message = if (cloud != null) "Ubicación recibida por Supabase" else "Ubicación recibida por la PC", lastSent = Instant.now().toString()) }
                } catch (error: ApiFailure) {
                    if (error.status == 400 || error.status == 409 || error.status == 422) database.mark(id, "historical") else throw error
                }
            }
        } catch (error: ApiFailure) {
            if (error.status == 401 || error.status == 403) { state { it.copy(message = "Sesión o vínculo no autorizado. Vuelve a iniciar sesión y vincular.") }; stopSelf() }
            else state { it.copy(message = "Destino no disponible; posiciones retenidas") }
        } catch (_: Exception) { state { it.copy(message = "Sin conexión con el destino; posiciones retenidas") } }
    }
    override fun onLocationChanged(location: Location) {
        if (closing || !location.hasAccuracy() || location.accuracy <= 0) return
        val now = System.currentTimeMillis()
        if (now - location.time > 90000 || location.time - now > 30000) return
        val idBinding = linkId ?: return
        val body = JSONObject().put("latitude", location.latitude).put("longitude", location.longitude).put("accuracy_m", location.accuracy.toDouble())
            .put("observed_at", Instant.ofEpochMilli(location.time).toString()).toString()
        executor.execute {
            if (closing) return@execute
            database.enqueue(idBinding, location.time, body)
            val zone = fence
            if (zone != null) {
                val distance = FloatArray(1)
                Location.distanceBetween(zone.getDouble("home_lat"), zone.getDouble("home_lng"), location.latitude, location.longitude, distance)
                val evaluation = engine.evaluate(distance[0].toDouble(), zone.getDouble("radius_m"), location.accuracy.toDouble(), location.time)
                state { it.copy(accuracy = location.accuracy, zone = evaluation.quality, lastFix = location.time) }
                if (evaluation.event == "GEOCERCA_SALIDA") alert("Fuera de la zona de referencia", "Salida detectada por el GPS de este celular")
            } else state { it.copy(accuracy = location.accuracy, zone = "Sin zona consultada", lastFix = location.time) }
        }
    }
    private fun connectBelt(address: String) {
        Thread({
            try {
                if (checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) != PackageManager.PERMISSION_GRANTED) throw SecurityException("Bluetooth permission revoked")
                val adapter = getSystemService(BluetoothManager::class.java).adapter ?: error("Sin Bluetooth")
                val socket = adapter.getRemoteDevice(address).createRfcommSocketToServiceRecord(UUID.fromString("00001101-0000-1000-8000-00805F9B34FB"))
                bluetooth = socket
                socket.connect()
                socket.outputStream.write("STREAM ON\n".toByteArray())
                val line = StringBuilder()
                while (!closing) {
                    val value = socket.inputStream.read()
                    if (value < 0) break
                    if (value == 10 || value == 13) {
                        val raw = line.toString(); line.clear()
                        val reading = BeltProtocol.parse(raw) ?: continue
                        state { it.copy(belt = reading) }
                        executor.execute { if (!closing) database.recordBelt(raw) }
                        if (reading.alert && raw != lastBeltAlert) { lastBeltAlert = raw; alert("Alerta del cinturón", reading.state.replace('_', ' ')) }
                    } else if (line.length < 512) line.append(value.toChar()) else line.clear()
                }
                if (!closing) state { it.copy(message = "Cinturón Bluetooth desconectado") }
            } catch (_: SecurityException) { if (!closing) state { it.copy(message = "Permiso Bluetooth retirado") } }
            catch (_: Exception) { if (!closing) state { it.copy(message = "No se pudo conectar el cinturón Bluetooth") } }
        }, "sfa-bluetooth").start()
    }
    private fun alert(title: String, message: String) {
        if (android.os.Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
        getSystemService(NotificationManager::class.java).notify(3, Notification.Builder(this, "alerts").setSmallIcon(R.drawable.ic_sfa)
            .setContentTitle(title).setContentText(message).setAutoCancel(true).build())
    }
    override fun onDestroy() {
        closing = true
        try { getSystemService(LocationManager::class.java).removeUpdates(this) } catch (_: Exception) { }
        try { bluetooth?.close() } catch (_: Exception) { }
        executor.shutdownNow()
        Thread { try { executor.awaitTermination(15, TimeUnit.SECONDS) } finally { database.close() } }.start()
        state { it.copy(running = false) }
        super.onDestroy()
    }
    override fun onBind(intent: Intent?): IBinder? = null
}
