package org.sfa.asistencia

import org.junit.Assert.*
import org.junit.Test

class PushEnvelopeTest {
    private val now = 1900000000000L
    private val id = "12345678-1234-4321-8000-123456789abc"
    private fun message(time: Long) = mapOf("event_id" to id, "observed_at_ms" to time.toString())
    @Test fun acceptsRecentEvent() { assertEquals(id, PushEnvelope.eventId(message(now), now)) }
    @Test fun rejectsOldAndFutureEvents() {
        assertNull(PushEnvelope.eventId(message(now - 300001), now))
        assertNull(PushEnvelope.eventId(message(now + 30001), now))
    }
    @Test fun rejectsMissingAndMalformedFields() {
        assertNull(PushEnvelope.eventId(emptyMap(), now))
        assertNull(PushEnvelope.eventId(message(now) + ("event_id" to "1-1-1-1-1"), now))
        assertNull(PushEnvelope.eventId(message(now) + ("observed_at_ms" to "invalid"), now))
    }
    @Test fun rejectsOverflowTimestamps() {
        assertNull(PushEnvelope.eventId(message(Long.MIN_VALUE), now))
        assertNull(PushEnvelope.eventId(message(Long.MAX_VALUE), now))
    }
}
