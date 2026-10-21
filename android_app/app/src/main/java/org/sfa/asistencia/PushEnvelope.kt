package org.sfa.asistencia

import java.util.UUID

object PushEnvelope {
    fun eventId(data: Map<String, String>, now: Long): String? {
        val event = data["event_id"] ?: return null
        if (!event.matches(Regex("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"))) return null
        val time = data["observed_at_ms"]?.toLongOrNull() ?: return null
        if (time < now - 300000L || time > now + 30000L) return null
        return try { UUID.fromString(event).toString() } catch (_: Exception) { null }
    }
}
