package org.sfa.asistencia

import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLHandshakeException
import org.junit.Assert.*
import org.junit.Test

class OperationErrorsTest {
    @Test fun timeoutIsNotCalledAnAndroidPermission() {
        assertTrue(operationErrorMessage(SocketTimeoutException()).contains("[RED-TIEMPO]"))
        assertTrue(operationErrorMessage(UnknownHostException()).contains("[RED-DNS]"))
        assertTrue(operationErrorMessage(IOException()).contains("[RED-CONEXION]"))
    }
    @Test fun securityAndSessionFailuresStayDistinct() {
        assertTrue(operationErrorMessage(ApiFailure(401)).contains("[HTTP-401]"))
        assertTrue(operationErrorMessage(ApiFailure(403)).contains("[HTTP-403]"))
        assertTrue(operationErrorMessage(SecurityException()).contains("[ANDROID-PERMISO]"))
        assertTrue(operationErrorMessage(SSLHandshakeException("private detail")).contains("[RED-TLS]"))
    }
    @Test fun privateExceptionTextIsNeverDisplayed() {
        for (error in listOf(IOException("private detail"), IllegalStateException("private detail"))) {
            assertFalse(operationErrorMessage(error).contains("private detail"))
        }
        assertTrue(operationErrorMessage(ApiFailure(503)).contains("[HTTP-503]"))
        assertTrue(operationErrorMessage(ApiFailure(429)).contains("[HTTP-429]"))
    }
}
