package org.sfa.asistencia
import org.junit.Assert.*
import org.junit.Test
class BeltProtocolTest {
    @Test fun parsesActualArduinoContract() {
        val reading = BeltProtocol.parse("TEL,1000,NORMAL,0.0,0.0,1.0,1.0,12.4,0.042,0")
        assertNotNull(reading)
        assertEquals(1.0, reading!!.acceleration!!, .001)
    }
    @Test fun rejectsInvalidReadingsAndDetectsEvents() {
        assertNull(BeltProtocol.parse("TEL,1,NORMAL,0,0,1,NaN,10,0,0"))
        assertTrue(BeltProtocol.parse("EVT,1000,CAIDA_CONFIRMADA,Impacto")!!.alert)
        assertNull(BeltProtocol.parse("RSP,STREAM,ON"))
    }
}
