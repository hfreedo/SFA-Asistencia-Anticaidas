package org.sfa.asistencia

import android.content.Context
import com.google.android.gms.tasks.Task
import com.google.firebase.FirebaseApp
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.util.UUID
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlin.coroutines.suspendCoroutine

private suspend fun <T> Task<T>.result(): T = suspendCoroutine { continuation ->
    addOnSuccessListener { continuation.resume(it) }
    addOnFailureListener { continuation.resumeWithException(it) }
    addOnCanceledListener { continuation.resumeWithException(IllegalStateException("Operación cancelada")) }
}

class PushRegistration(private val context: Context) {
    private val preferences get() = context.getSharedPreferences("push", Context.MODE_PRIVATE)
    val enabled get() = preferences.getBoolean("enabled", false)
    val renewalPending get() = preferences.getBoolean("renewal_pending", false)
    val configured get() = FirebaseApp.getApps(context).isNotEmpty()
    suspend fun test(jwt: String, resident: String) {
        check(enabled) { "Activa los avisos primero" }
        val installation = preferences.getString("installation", null) ?: error("Sin registro")
        withContext(Dispatchers.IO) {
            NativeApi(context).rpc("sfa_request_push_test", jwt, JSONObject().put("p_resident", resident).put("p_installation", installation))
        }
    }
    suspend fun update(jwt: String, active: Boolean) {
        check(configured) { "Falta la configuración Firebase" }
        val installation = preferences.getString("installation", null) ?: UUID.randomUUID().toString().also {
            preferences.edit().putString("installation", it).commit()
        }
        val messaging = FirebaseMessaging.getInstance()
        if (!active) preferences.edit().putBoolean("enabled", false).commit()
        if (active) messaging.isAutoInitEnabled = true
        try {
            val token = if (active) messaging.token.result() else null
            val body = JSONObject().put("p_installation", installation).put("p_token", token ?: JSONObject.NULL).put("p_enabled", active).toString()
            withContext(Dispatchers.IO) {
                NativeApi(context).request("https://lxymfaoraayccmxwiubw.supabase.co/rest/v1/rpc/sfa_register_push", jwt, body)
            }
            if (!active) {
                messaging.isAutoInitEnabled = false
                messaging.deleteToken().result()
                preferences.edit().remove("installation").apply()
            }
            preferences.edit().putBoolean("enabled", active).putBoolean("renewal_pending", false).commit()
        } catch (error: Exception) {
            if (!enabled) messaging.isAutoInitEnabled = false
            throw error
        }
    }
}
