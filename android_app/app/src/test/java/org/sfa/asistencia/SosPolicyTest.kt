package org.sfa.asistencia

import org.junit.Assert.*
import org.junit.Test

class SosPolicyTest {
    private val now = 1900000000000L
    @Test fun acceptsRecentAndRejectsExpiredSos() {
        assertTrue(SosPolicy.recent(now, now)); assertTrue(SosPolicy.recent(now - 300000, now))
        assertFalse(SosPolicy.recent(now - 300001, now))
    }
    @Test fun rejectsInvalidAndFutureTimestamps() {
        assertFalse(SosPolicy.recent(0, now)); assertFalse(SosPolicy.recent(Long.MIN_VALUE, now))
        assertFalse(SosPolicy.recent(now + 30001, now)); assertTrue(SosPolicy.recent(now + 30000, now))
    }
}
