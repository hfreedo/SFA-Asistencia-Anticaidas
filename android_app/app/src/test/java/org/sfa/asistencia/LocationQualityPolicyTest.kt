package org.sfa.asistencia

import org.junit.Assert.*
import org.junit.Test

class LocationQualityPolicyTest {
    private val now = 100_000L
    @Test fun broadNetworkCannotOverwriteRecentGps() {
        assertFalse(LocationQualityPolicy.accept(FixQuality("gps", 5.0, now - 10_000), FixQuality("network", 100.0, now), now))
    }
    @Test fun accurateMovementIsNotSmoothedAway() {
        assertTrue(LocationQualityPolicy.accept(FixQuality("gps", 5.0, now - 10_000), FixQuality("gps", 8.0, now), now))
    }
    @Test fun staleGpsAllowsHonestImpreciseFallback() {
        assertTrue(LocationQualityPolicy.accept(FixQuality("gps", 5.0, now - 31_000), FixQuality("network", 100.0, now), now))
    }
    @Test fun improvedFixIsAcceptedWithoutWaitingForOldAccuracy() {
        assertTrue(LocationQualityPolicy.accept(FixQuality("network", 100.0, now - 1000), FixQuality("gps", 6.0, now), now))
    }
    @Test fun staleOutOfOrderAndInvalidFixesAreRejected() {
        assertFalse(LocationQualityPolicy.accept(null, FixQuality("gps", Double.NaN, now), now))
        assertFalse(LocationQualityPolicy.accept(null, FixQuality("gps", 5.0, now - 91_000), now))
        assertFalse(LocationQualityPolicy.accept(FixQuality("gps", 5.0, now), FixQuality("gps", 5.0, now - 1), now))
    }
}
