package org.sfa.asistencia

import org.json.JSONObject

/** Kept only in this process. Restarting the app requires a new sign-in. */
object CloudGpsSession {
    private var session: JSONObject? = null
    @Synchronized fun login(value: JSONObject) { session = value }
    @Synchronized fun clear() { session = null }
    @Synchronized fun token(api: NativeApi): String {
        var current = session ?: throw ApiFailure(401)
        if (current.optLong("expires_at") * 1000L < System.currentTimeMillis() + 60000L) {
            current = JSONObject(api.request("https://lxymfaoraayccmxwiubw.supabase.co/auth/v1/token?grant_type=refresh_token",
                body = JSONObject().put("refresh_token", current.getString("refresh_token")).toString()))
            session = current
        }
        return current.getString("access_token")
    }
}
