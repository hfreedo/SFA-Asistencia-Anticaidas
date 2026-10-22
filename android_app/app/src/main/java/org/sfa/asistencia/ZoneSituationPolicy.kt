package org.sfa.asistencia

import java.time.Instant

data class ZoneSituationStatus(val state: String, val lastConfirmed: String, val observedAt: String?)
data class ZoneSituationNotice(val title: String, val detail: String, val warning: Boolean)

fun zoneSituationNotice(zone: ZoneSituationStatus?, now: Long, connected: Boolean, closed: Boolean): ZoneSituationNotice? {
    if (zone == null || zone.state == "unconfigured") return null
    val age = zone.observedAt?.let { runCatching { now - Instant.parse(it).toEpochMilli() }.getOrNull() }
    val recent = connected && age != null && age in -30000L..90000L
    if (recent && zone.state == "inside") return ZoneSituationNotice("Dentro de la zona confirmado",
        "La posición permite confirmar la zona. Los incidentes pendientes requieren atención por separado.", false)
    if (recent && zone.state == "outside") return ZoneSituationNotice(
        if (closed) "Atención cerrada, pero continúa fuera de la geocerca" else "La persona continúa fuera de la geocerca",
        "Cerrar la atención no confirma el regreso. El seguimiento continúa sin repetir un aviso por cada posición.", true)
    val title = if (zone.lastConfirmed == "outside") "Última salida confirmada; reingreso no confirmado" else "No se puede confirmar la situación de la zona"
    return ZoneSituationNotice(title, if (!recent) "Sin posición reciente verificada. No se considera que haya vuelto a la zona."
        else "GPS incierto o impreciso: todavía no se puede confirmar un reingreso.", zone.lastConfirmed == "outside")
}
