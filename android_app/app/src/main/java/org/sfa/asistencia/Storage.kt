package org.sfa.asistencia

import android.content.Context
import android.content.ContentValues
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import org.json.JSONObject
import java.net.URI
import java.security.KeyStore
import java.util.UUID
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

data class PhoneBinding(val id: String, val origin: String, val token: String) {
    companion object {
        fun parse(value: String): PhoneBinding {
            val uri = URI(value.trim())
            require(uri.scheme == "https" && uri.host != null && uri.userInfo == null && uri.path == "/compartir-ubicacion" && uri.query == null) { "El QR debe ser el vínculo HTTPS de ubicación de SFA" }
            val host = uri.host.lowercase().trim('[', ']')
            require(host != "localhost" && host != "::1" && !host.startsWith("127.")) { "El QR debe apuntar a la PC, no al celular" }
            val fragment = uri.rawFragment ?: ""
            require(fragment.startsWith("token=")) { "Vínculo sin autorización" }
            val token = fragment.removePrefix("token=")
            require(token.matches(Regex("[A-Za-z0-9_-]{32,128}"))) { "Autorización no válida" }
            return PhoneBinding(UUID.randomUUID().toString(), "https://${uri.rawAuthority}", token)
        }
    }
}

class SecureBinding(private val context: Context) {
    private val file get() = context.filesDir.resolve("binding.enc")
    private fun key(): SecretKey {
        val store = KeyStore.getInstance("AndroidKeyStore").apply { load(null) }
        (store.getKey("sfa.binding", null) as? SecretKey)?.let { return it }
        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore").apply {
            init(KeyGenParameterSpec.Builder("sfa.binding", KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE).setKeySize(256).build())
        }.generateKey()
    }
    fun save(binding: PhoneBinding) {
        val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.ENCRYPT_MODE, key()) }
        val json = JSONObject().put("id", binding.id).put("origin", binding.origin).put("token", binding.token).toString()
        val data = cipher.iv + cipher.doFinal(json.toByteArray(Charsets.UTF_8))
        val temporary = context.filesDir.resolve("binding.tmp")
        temporary.writeText(Base64.encodeToString(data, Base64.NO_WRAP))
        check(temporary.renameTo(file)) { "No se pudo guardar el vínculo" }
    }
    fun load(): PhoneBinding? = try {
        if (!file.exists()) null else {
            val data = Base64.decode(file.readText(), Base64.NO_WRAP)
            val cipher = Cipher.getInstance("AES/GCM/NoPadding").apply { init(Cipher.DECRYPT_MODE, key(), GCMParameterSpec(128, data.copyOfRange(0, 12))) }
            val json = JSONObject(String(cipher.doFinal(data.copyOfRange(12, data.size)), Charsets.UTF_8))
            PhoneBinding(json.getString("id"), json.getString("origin"), json.getString("token"))
        }
    } catch (_: Exception) { null }
    fun clear() { file.delete() }
}

data class PendingSos(val id: String, val observed: Long, val simulated: Boolean)

class LocationOutbox(context: Context) : SQLiteOpenHelper(context, "sfa-history.sqlite3", null, 2) {
    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE positions(id TEXT PRIMARY KEY,binding TEXT NOT NULL,observed INTEGER NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL)")
        db.execSQL("CREATE INDEX pending_positions ON positions(binding,status,observed)")
        db.execSQL("CREATE TABLE belt_records(id TEXT PRIMARY KEY,observed INTEGER NOT NULL,line TEXT NOT NULL)")
        createSos(db)
    }
    private fun createSos(db: SQLiteDatabase) {
        db.execSQL("CREATE TABLE phone_sos(id TEXT PRIMARY KEY,device TEXT NOT NULL,observed INTEGER NOT NULL,simulated INTEGER NOT NULL,status TEXT NOT NULL)")
        db.execSQL("CREATE INDEX pending_sos ON phone_sos(device,status,observed)")
    }
    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) { if (oldVersion < 2) createSos(db) }
    fun queueSos(device: String, simulated: Boolean): String {
        val db = writableDatabase
        db.beginTransaction()
        try {
            val now = System.currentTimeMillis()
            db.update("phone_sos", ContentValues().apply { put("status", "historical") }, "device=? AND status='pending' AND observed<?", arrayOf(device, (now - 300000).toString()))
            val existing = db.rawQuery("SELECT id FROM phone_sos WHERE device=? AND simulated=? AND status='pending' LIMIT 1", arrayOf(device, if (simulated) "1" else "0")).use { if (it.moveToFirst()) it.getString(0) else null }
            val id = existing ?: UUID.randomUUID().toString().also { value -> db.insertOrThrow("phone_sos", null, ContentValues().apply {
                put("id", value); put("device", device); put("observed", now); put("simulated", if (simulated) 1 else 0); put("status", "pending")
            }) }
            db.setTransactionSuccessful(); return id
        } finally { db.endTransaction() }
    }
    fun pendingSos(device: String): List<PendingSos> = readableDatabase.rawQuery("SELECT id,observed,simulated FROM phone_sos WHERE device=? AND status='pending' ORDER BY simulated,observed LIMIT 10", arrayOf(device)).use { cursor ->
        buildList { while (cursor.moveToNext()) add(PendingSos(cursor.getString(0), cursor.getLong(1), cursor.getInt(2) != 0)) }
    }
    fun markSos(id: String, status: String) { writableDatabase.update("phone_sos", ContentValues().apply { put("status", status) }, "id=?", arrayOf(id)) }
    fun enqueue(binding: String, observed: Long, payload: String) {
        writableDatabase.insertOrThrow("positions", null, ContentValues().apply {
            put("id", UUID.randomUUID().toString()); put("binding", binding); put("observed", observed); put("payload", payload); put("status", "pending")
        })
    }
    fun pending(binding: String): List<Triple<String, Long, String>> = readableDatabase.rawQuery("SELECT id,observed,payload FROM positions WHERE binding=? AND status='pending' ORDER BY observed DESC LIMIT 25", arrayOf(binding)).use { cursor ->
        buildList { while (cursor.moveToNext()) add(Triple(cursor.getString(0), cursor.getLong(1), cursor.getString(2))) }
    }
    fun mark(id: String, status: String) { writableDatabase.update("positions", ContentValues().apply { put("status", status) }, "id=?", arrayOf(id)) }
    fun recordBelt(line: String) { writableDatabase.insertOrThrow("belt_records", null, ContentValues().apply { put("id", UUID.randomUUID().toString()); put("observed", System.currentTimeMillis()); put("line", line.take(512)) }) }
}
