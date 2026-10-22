package org.sfa.asistencia

import org.junit.Assert.*
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.util.concurrent.Executors

class MemoryCatalogTest {
    @get:Rule val folder = TemporaryFolder()
    // Marker-only fixtures test storage, not Android image decoding.
    private val jpeg = byteArrayOf(0xff.toByte(), 0xd8.toByte(), 0xff.toByte(), 0xd9.toByte())
    private fun catalog() = MemoryCatalog(folder.root)

    @Test fun newAlbumIsEmpty() { assertTrue(catalog().list().isEmpty()) }
    @Test fun copiesAndTitlesSurviveReopening() {
        val store = catalog()
        val photo = store.add(jpeg, jpeg, "  Mi familia  ")
        assertEquals("Mi familia", catalog().list().single().title)
        assertArrayEquals(jpeg, store.photoFile(photo.id).readBytes())
        assertArrayEquals(jpeg, store.photoFile(photo.id, true).readBytes())
    }
    @Test fun favoritesAndUnicodeTitlesPersistWithoutChangingOtherPhotos() {
        val store = catalog()
        val first = store.add(jpeg, jpeg)
        val second = store.add(jpeg, jpeg, "Otro")
        store.update(first.id, "Cumpleaños de mamá", true)
        val reopened = catalog().list()
        assertEquals("Cumpleaños de mamá", reopened.first { it.id == first.id }.title)
        assertTrue(reopened.first { it.id == first.id }.favorite)
        assertEquals(second, reopened.first { it.id == second.id })
        assertEquals(first.createdAt, reopened.first { it.id == first.id }.createdAt)
    }
    @Test fun deleteRemovesBothCopiesAndPersists() {
        val store = catalog()
        val photo = store.add(jpeg, jpeg)
        store.delete(photo.id)
        assertTrue(catalog().list().isEmpty())
        assertFalse(store.photoFile(photo.id).exists())
        assertFalse(store.photoFile(photo.id, true).exists())
    }
    @Test fun limitsCountWithoutOverwritingEarlierPhotos() {
        val store = catalog()
        repeat(MemoryCatalog.LIMIT) { store.add(jpeg, jpeg) }
        assertThrows(IllegalArgumentException::class.java) { store.add(jpeg, jpeg) }
        assertEquals(MemoryCatalog.LIMIT, catalog().list().size)
    }
    @Test fun rejectsInvalidAndOversizedPhotoData() {
        assertThrows(IllegalArgumentException::class.java) { catalog().add(byteArrayOf(1), jpeg) }
        val large = ByteArray(MemoryCatalog.PHOTO_LIMIT + 1)
        assertThrows(IllegalArgumentException::class.java) { catalog().add(large, jpeg) }
        assertTrue(catalog().list().isEmpty())
    }
    @Test fun titlesHaveABoundAndMissingPhotosCannotBeEdited() {
        val store = catalog()
        assertThrows(IllegalArgumentException::class.java) { store.add(jpeg, jpeg, "x".repeat(101)) }
        val item = store.add(jpeg, jpeg)
        assertThrows(IllegalArgumentException::class.java) { store.update(item.id, "x".repeat(101), false) }
        store.delete(item.id)
        assertThrows(IllegalStateException::class.java) { store.update(item.id, "Gone", false) }
    }
    @Test fun pathsCannotEscapeTheAlbum() {
        assertThrows(IllegalArgumentException::class.java) { catalog().photoFile("../binding.enc") }
        assertThrows(IllegalArgumentException::class.java) { catalog().photoFile("/tmp/photo") }
    }
    @Test fun aCorruptAlbumIsNotSilentlyReplaced() {
        val file = folder.root.resolve("catalog.bin")
        val original = byteArrayOf(1, 2, 3)
        file.writeBytes(original)
        assertThrows(Exception::class.java) { catalog().add(jpeg, jpeg) }
        assertArrayEquals(original, file.readBytes())
    }
    @Test fun simultaneousImportsDoNotLosePhotosAcrossInstances() {
        val executor = Executors.newFixedThreadPool(4)
        try {
            val pending = (1..12).map { executor.submit<MemoryPhoto> { catalog().add(jpeg, jpeg) } }
            pending.forEach { it.get() }
            assertEquals(12, catalog().list().size)
        } finally { executor.shutdownNow() }
    }
}
