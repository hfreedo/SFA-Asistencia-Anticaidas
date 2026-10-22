package org.sfa.asistencia

import org.junit.Assert.*
import org.junit.Test
import java.time.Instant

class ZoneSituationPolicyTest {
    private val now = Instant.parse("2026-10-21T12:00:00Z").toEpochMilli()
    private val outside = ZoneSituationStatus("outside", "outside", Instant.ofEpochMilli(now - 10000).toString())
    @Test fun closedAttentionDoesNotDismissOutsideSituation() {
        val notice = zoneSituationNotice(outside, now, true, true)!!
        assertTrue(notice.warning); assertTrue(notice.title.contains("continúa fuera"))
    }
    @Test fun uncertainLocationRetainsLastConfirmedExit() {
        for (state in listOf("imprecise", "uncertain", "stale")) {
            val notice = zoneSituationNotice(outside.copy(state = state), now, true, true)!!
            assertTrue(notice.warning); assertTrue(notice.title.contains("reingreso no confirmado"))
        }
    }
    @Test fun oldDataOrOfflineCannotClaimCurrentOutsideOrReentry() {
        assertTrue(zoneSituationNotice(outside, now + 100000, true, true)!!.title.contains("reingreso no confirmado"))
        assertTrue(zoneSituationNotice(outside, now, false, true)!!.title.contains("reingreso no confirmado"))
    }
    @Test fun freshInsideReplacesOutsideWarning() {
        assertFalse(zoneSituationNotice(outside.copy(state = "inside", lastConfirmed = "inside"), now, true, true)!!.warning)
    }
    @Test fun absentOrInvalidContextNeverClaimsSafety() {
        assertNull(zoneSituationNotice(null, now, true, true))
        assertTrue(zoneSituationNotice(outside.copy(observedAt = "invalid"), now, true, true)!!.title.contains("reingreso no confirmado"))
    }
}
