package org.sfa.asistencia

data class FixQuality(val provider: String, val accuracy: Double, val observed: Long)

object LocationQualityPolicy {
    fun accept(previous: FixQuality?, incoming: FixQuality, now: Long): Boolean {
        if (!incoming.accuracy.isFinite() || incoming.accuracy <= 0 || incoming.observed <= 0 ||
            now - incoming.observed > 90_000 || incoming.observed - now > 30_000) return false
        if (previous == null) return true
        if (incoming.observed <= previous.observed) return false
        val freshPrevious = now - previous.observed <= 30_000
        // A broad network fix must not replace a recent, substantially more accurate measurement.
        if (freshPrevious && incoming.accuracy > maxOf(previous.accuracy * 2, previous.accuracy + 20)) return false
        return true
    }
}
