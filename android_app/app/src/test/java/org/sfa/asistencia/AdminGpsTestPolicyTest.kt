package org.sfa.asistencia

import org.junit.Assert.*
import org.junit.Test

class AdminGpsTestPolicyTest {
    @Test fun onlyValidFreshCoordinatesCanEnterTheTest() {
        val now = 1_000_000L
        assertTrue(AdminGpsTestPolicy.validFix(now, now, 5.0, -25.0, -57.0))
        assertFalse(AdminGpsTestPolicy.validFix(now - 91_000, now, 5.0, 0.0, 0.0))
        assertFalse(AdminGpsTestPolicy.validFix(now, now, Double.NaN, 0.0, 0.0))
        assertFalse(AdminGpsTestPolicy.validFix(now, now, 5.0, 91.0, 0.0))
        assertFalse(AdminGpsTestPolicy.validFix(now, now, 5.0, 0.0, Double.POSITIVE_INFINITY))
    }
    @Test fun jitterDuplicatesAndOutOfOrderSamplesAreNotSubmitted() {
        assertTrue(AdminGpsTestPolicy.shouldSend(null, 100_000))
        assertFalse(AdminGpsTestPolicy.shouldSend(100_000, 100_000))
        assertFalse(AdminGpsTestPolicy.shouldSend(100_000, 99_000))
        assertFalse(AdminGpsTestPolicy.shouldSend(100_000, 107_999))
        assertTrue(AdminGpsTestPolicy.shouldSend(100_000, 108_000))
    }
}
