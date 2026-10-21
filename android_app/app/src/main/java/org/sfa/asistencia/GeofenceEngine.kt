package org.sfa.asistencia

import kotlin.math.min

data class ZoneEvaluation(val quality: String, val stable: String, val event: String? = null)

/** Uses measured uncertainty, hysteresis and dwell; never treats a missing fix as safe. */
class GeofenceEngine {
    private var candidate: String? = null
    private var since = 0L
    private var previous = 0L
    private var count = 0
    private var stable = "unknown"
    fun reset() { candidate = null; previous = 0; count = 0; stable = "unknown" }
    fun evaluate(distance: Double, radius: Double, accuracy: Double, observed: Long): ZoneEvaluation {
        if (!distance.isFinite() || !radius.isFinite() || !accuracy.isFinite() || distance < 0 || radius < 5 || accuracy <= 0 || observed <= previous) return ZoneEvaluation("invalid", stable)
        val margin = min(10.0, radius * .1)
        val target = when {
            accuracy > 50 -> null
            distance - accuracy > radius + margin -> "outside"
            distance + accuracy < radius - margin -> "inside"
            else -> null
        }
        if (target == null) {
            candidate = null; count = 0; previous = observed
            return ZoneEvaluation(if (accuracy > 50) "imprecise" else "uncertain", stable)
        }
        if (candidate != target || observed - previous > 90_000) { candidate = target; since = observed; count = 0 }
        previous = observed; count++
        if (count < 2 || observed - since < 10_000) return ZoneEvaluation("pending", stable)
        val event = if (target == stable) null else if (target == "outside") "GEOCERCA_SALIDA" else if (stable == "outside") "GEOCERCA_REINGRESO" else null
        stable = target
        return ZoneEvaluation(target, stable, event)
    }
}
