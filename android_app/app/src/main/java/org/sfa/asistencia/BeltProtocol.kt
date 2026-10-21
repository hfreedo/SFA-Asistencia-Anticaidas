package org.sfa.asistencia

data class BeltReading(val state: String, val acceleration: Double?, val tilt: Double?, val alert: Boolean)
object BeltProtocol {
    fun parse(line: String): BeltReading? {
        if (line.length > 512) return null
        val fields = line.trim().split(',')
        if (fields.firstOrNull() == "TEL" && fields.size == 10) {
            val state = fields[2]
            if (state !in setOf("NORMAL", "EVENTO_INERCIAL", "POSIBLE_CAIDA", "CAIDA_CONFIRMADA", "ALERTA_SILENCIADA")) return null
            val acceleration = fields[6].toDoubleOrNull() ?: return null
            val tilt = fields[7].toDoubleOrNull() ?: return null
            if (!acceleration.isFinite() || acceleration !in 0.0..100.0 || !tilt.isFinite() || tilt !in 0.0..180.0) return null
            return BeltReading(state, acceleration, tilt, false)
        }
        if (fields.firstOrNull() == "EVT" && fields.size >= 4) return BeltReading(fields[2], null, null, fields[2] == "CAIDA_CONFIRMADA" || fields[2].contains("SOS"))
        return null
    }
}
