package org.sfa.asistencia

import org.junit.Assert.*
import org.junit.Test

class GeofenceEngineTest {
    @Test fun smallZoneUsesIntervalAndDwell() {
        val engine = GeofenceEngine()
        assertEquals("pending", engine.evaluate(15.44, 5.0, 9.6, 1000).quality)
        assertEquals("GEOCERCA_SALIDA", engine.evaluate(15.44, 5.0, 9.6, 12000).event)
        assertNull(engine.evaluate(15.44, 5.0, 9.6, 23000).event)
    }
    @Test fun uncertainFixNeverConfirms() {
        val engine = GeofenceEngine()
        engine.evaluate(8.0, 5.0, 10.0, 1000)
        assertEquals("uncertain", engine.evaluate(8.0, 5.0, 10.0, 12000).quality)
        assertNull(engine.evaluate(100.0, 5.0, 51.0, 23000).event)
    }
    @Test fun gapAndResetRequireNewDwell() {
        val engine = GeofenceEngine()
        engine.evaluate(20.0, 5.0, 4.0, 1000)
        assertNull(engine.evaluate(20.0, 5.0, 4.0, 100000).event)
        assertEquals("GEOCERCA_SALIDA", engine.evaluate(20.0, 5.0, 4.0, 111000).event)
        engine.reset()
        assertNull(engine.evaluate(20.0, 5.0, 4.0, 120000).event)
    }
}
