package org.sfa.asistencia

object SosPolicy {
    fun recent(observed: Long, now: Long): Boolean = observed > 0 && observed >= now - 300000L && observed <= now + 30000L
}
