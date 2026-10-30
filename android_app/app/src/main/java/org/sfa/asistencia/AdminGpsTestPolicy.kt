package org.sfa.asistencia

object AdminGpsTestPolicy {
    fun validFix(observed: Long, now: Long, accuracy: Double, latitude: Double, longitude: Double): Boolean =
        observed > 0 && now - observed in -30_000L..90_000L && accuracy.isFinite() && accuracy > 0 && accuracy <= 10_000 &&
            latitude.isFinite() && latitude in -90.0..90.0 && longitude.isFinite() && longitude in -180.0..180.0

    fun shouldSend(previous: Long?, observed: Long): Boolean = previous == null || observed - previous >= 8_000L
}
