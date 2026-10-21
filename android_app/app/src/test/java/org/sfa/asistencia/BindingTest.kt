package org.sfa.asistencia
import org.junit.Assert.*
import org.junit.Test

class BindingTest {
    private val token = "a".repeat(43)
    @Test fun parsesPrivateQrWithoutExposingTokenInOrigin() {
        val binding = PhoneBinding.parse("https://192.168.1.5:8780/compartir-ubicacion#token=$token")
        assertEquals("https://192.168.1.5:8780", binding.origin)
        assertEquals(token, binding.token)
        assertFalse(binding.origin.contains(token))
    }
    @Test fun rejectsWrongSchemeLocalhostAndCredentials() {
        for (url in listOf("http://192.168.1.5:8780/compartir-ubicacion#token=$token", "https://localhost:8780/compartir-ubicacion#token=$token", "https://user:pass@192.168.1.5/compartir-ubicacion#token=$token", "https://192.168.1.5/otro#token=$token")) {
            try { PhoneBinding.parse(url); fail("Invalid binding accepted") } catch (_: IllegalArgumentException) { }
        }
    }
    @Test fun boundedReadsDoNotAcceptOversizedInput() {
        assertArrayEquals(byteArrayOf(1, 2), readLimited(byteArrayOf(1, 2).inputStream(), 2))
        try { readLimited(byteArrayOf(1, 2, 3).inputStream(), 2); fail("Oversized input accepted") } catch (_: IllegalArgumentException) { }
    }
}
