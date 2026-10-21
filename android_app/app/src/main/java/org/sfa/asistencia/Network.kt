package org.sfa.asistencia

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.io.IOException
import java.io.InputStream
import java.io.ByteArrayOutputStream
import java.net.URL
import java.security.KeyStore
import java.security.cert.CertificateFactory
import javax.net.ssl.HttpsURLConnection
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManagerFactory

class ApiFailure(val status: Int) : IOException("Solicitud rechazada ($status)")

fun readLimited(stream: InputStream, limit: Int): ByteArray {
    val output = ByteArrayOutputStream()
    val buffer = ByteArray(4096)
    while (output.size() <= limit) {
        val count = stream.read(buffer, 0, minOf(buffer.size, limit + 1 - output.size()))
        if (count < 0) break
        output.write(buffer, 0, count)
    }
    require(output.size() <= limit) { "Respuesta demasiado grande" }
    return output.toByteArray()
}

class NativeApi(private val context: Context) {
    private val ca get() = context.filesDir.resolve("pc-ca.cer")
    fun installCa(bytes: ByteArray) {
        require(bytes.size <= 32768) { "Certificado demasiado grande" }
        val certificate = CertificateFactory.getInstance("X.509").generateCertificate(bytes.inputStream()) as java.security.cert.X509Certificate
        certificate.checkValidity()
        require(certificate.basicConstraints >= 0) { "Se requiere el certificado CA, no una clave ni el certificado del servidor" }
        val temporary = context.filesDir.resolve("pc-ca.tmp")
        temporary.writeBytes(bytes)
        check(temporary.renameTo(ca))
    }
    fun request(url: String, token: String? = null, body: String? = null, local: Boolean = false): String {
        val address = URL(url)
        require(address.protocol == "https" && address.userInfo == null)
        if (!local) require(address.host == "lxymfaoraayccmxwiubw.supabase.co")
        val connection = address.openConnection() as HttpsURLConnection
        connection.connectTimeout = 15000; connection.readTimeout = 30000
        connection.instanceFollowRedirects = false
        if (local && ca.exists()) {
            val store = KeyStore.getInstance(KeyStore.getDefaultType()).apply { load(null) }
            val certificate = CertificateFactory.getInstance("X.509").generateCertificate(ca.inputStream().use { it.readBytes().inputStream() })
            store.setCertificateEntry("pc", certificate)
            val managers = TrustManagerFactory.getInstance(TrustManagerFactory.getDefaultAlgorithm()).apply { init(store) }
            connection.sslSocketFactory = SSLContext.getInstance("TLS").apply { init(null, managers.trustManagers, null) }.socketFactory
        }
        connection.setRequestProperty("Content-Type", "application/json")
        if (token != null) connection.setRequestProperty("Authorization", "Bearer $token")
        if (!local) connection.setRequestProperty("apikey", "sb_publishable_tlHmnEy5vrZghpCDtuehjg_IpGtEn4S")
        try {
            if (body != null) { connection.requestMethod = "POST"; connection.doOutput = true; connection.outputStream.use { it.write(body.toByteArray(Charsets.UTF_8)) } }
            val status = connection.responseCode
            if (status !in 200..299) throw ApiFailure(status)
            return connection.inputStream.use { String(readLimited(it, 1048576), Charsets.UTF_8) }
        } finally { connection.disconnect() }
    }
    fun deviceContext(binding: PhoneBinding) = JSONObject(request(binding.origin + "/api/location/context", binding.token, local = true))
    fun position(binding: PhoneBinding, body: String) = JSONObject(request(binding.origin + "/api/location", binding.token, body, local = true))
    fun login(email: String, password: String): String {
        val session = JSONObject(request("https://lxymfaoraayccmxwiubw.supabase.co/auth/v1/token?grant_type=password", body = JSONObject().put("email", email).put("password", password).toString()))
        CloudGpsSession.login(session)
        return session.getString("access_token")
    }
    fun rpc(name: String, token: String, body: JSONObject): JSONObject {
        require(name.matches(Regex("sfa_[a-z_]+")))
        return JSONObject(request("https://lxymfaoraayccmxwiubw.supabase.co/rest/v1/rpc/$name", token, body.toString()))
    }
    fun remotePositions(token: String, resident: String): JSONArray {
        require(resident.matches(Regex("[0-9a-fA-F-]{36}")))
        return JSONArray(request("https://lxymfaoraayccmxwiubw.supabase.co/rest/v1/sfa_positions?select=latitude,longitude,accuracy_m,observed_at&resident_id=eq.$resident&simulated=eq.false&order=observed_at.desc&limit=1", token))
    }
    fun remoteResidents(token: String): JSONArray = JSONArray(request("https://lxymfaoraayccmxwiubw.supabase.co/rest/v1/sfa_residents?select=id,full_name,room&archived_at=is.null&order=full_name", token))
    fun remoteEvents(token: String, resident: String): JSONArray {
        require(resident.matches(Regex("[0-9a-fA-F-]{36}")))
        return JSONArray(request("https://lxymfaoraayccmxwiubw.supabase.co/rest/v1/sfa_events?select=event_type,observed_at,simulated&resident_id=eq.$resident&order=observed_at.desc&limit=12", token))
    }
}
