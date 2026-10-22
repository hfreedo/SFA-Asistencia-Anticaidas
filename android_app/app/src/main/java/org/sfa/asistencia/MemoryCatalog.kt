package org.sfa.asistencia

import java.io.DataInputStream
import java.io.DataOutputStream
import java.io.File
import java.io.FileOutputStream
import java.nio.file.Files
import java.nio.file.StandardCopyOption
import java.util.UUID

data class MemoryPhoto(val id: String, val title: String, val createdAt: Long, val favorite: Boolean = false)

/** Device-local album, independent of sessions, GPS and cloud queues. */
class MemoryCatalog(private val directory: File) {
    companion object {
        const val LIMIT = 60
        const val TITLE_LIMIT = 100
        const val PHOTO_LIMIT = 8 * 1024 * 1024
        private const val MAGIC = 0x5346414D
        private val lock = Any()
    }
    private val catalog get() = directory.resolve("catalog.bin")
    private fun validId(id: String) = id.matches(Regex("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"))
    fun photoFile(id: String, thumbnail: Boolean = false): File {
        require(validId(id)) { "Recuerdo no valido" }
        return directory.resolve(id + if (thumbnail) ".thumb.jpg" else ".jpg")
    }
    fun list(): List<MemoryPhoto> = synchronized(lock) { read() }
    private fun read(): List<MemoryPhoto> {
        if (!catalog.exists()) return emptyList()
        require(catalog.length() <= 128 * 1024) { "No se pudo leer el album" }
        return DataInputStream(catalog.inputStream().buffered()).use { input ->
            require(input.readInt() == MAGIC && input.readInt() == 1) { "Formato de album no reconocido" }
            val count = input.readInt()
            require(count in 0..LIMIT) { "Album no valido" }
            val items = List(count) {
                val item = MemoryPhoto(input.readUTF(), input.readUTF(), input.readLong(), input.readBoolean())
                require(validId(item.id) && item.title.length <= TITLE_LIMIT && item.createdAt >= 0) { "Recuerdo no valido" }
                item
            }
            require(items.map { it.id }.distinct().size == count && input.read() == -1) { "Album no valido" }
            items
        }
    }
    private fun write(items: List<MemoryPhoto>) {
        check(directory.isDirectory || directory.mkdirs()) { "No se pudo abrir el album" }
        val temporary = directory.resolve("catalog.tmp")
        try {
            FileOutputStream(temporary).use { stream ->
                val output = DataOutputStream(stream)
                output.writeInt(MAGIC); output.writeInt(1); output.writeInt(items.size)
                items.forEach { output.writeUTF(it.id); output.writeUTF(it.title); output.writeLong(it.createdAt); output.writeBoolean(it.favorite) }
                output.flush(); stream.fd.sync()
            }
            Files.move(temporary.toPath(), catalog.toPath(), StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING)
        } finally { temporary.delete() }
    }
    fun add(photo: ByteArray, thumbnail: ByteArray, title: String = ""): MemoryPhoto = synchronized(lock) {
        val items = read()
        require(items.size < LIMIT) { "El album admite hasta $LIMIT fotos" }
        require(title.trim().length <= TITLE_LIMIT) { "El titulo es demasiado largo" }
        fun jpeg(bytes: ByteArray, limit: Int) = bytes.size in 4..limit && bytes[0] == 0xff.toByte() && bytes[1] == 0xd8.toByte() && bytes[bytes.size - 2] == 0xff.toByte() && bytes.last() == 0xd9.toByte()
        require(jpeg(photo, PHOTO_LIMIT) && jpeg(thumbnail, 512 * 1024)) { "La foto no se pudo preparar" }
        check(directory.isDirectory || directory.mkdirs()) { "No se pudo guardar la foto" }
        val item = MemoryPhoto(UUID.randomUUID().toString(), title.trim(), System.currentTimeMillis())
        val image = photoFile(item.id)
        val thumb = photoFile(item.id, true)
        try {
            FileOutputStream(image).use { it.write(photo); it.fd.sync() }
            FileOutputStream(thumb).use { it.write(thumbnail); it.fd.sync() }
            write(listOf(item) + items)
        } catch (error: Exception) { image.delete(); thumb.delete(); throw error }
        item
    }
    fun update(id: String, title: String, favorite: Boolean): MemoryPhoto = synchronized(lock) {
        require(title.trim().length <= TITLE_LIMIT) { "El titulo es demasiado largo" }
        val items = read()
        val current = items.firstOrNull { it.id == id } ?: error("Este recuerdo ya no esta disponible")
        val updated = current.copy(title = title.trim(), favorite = favorite)
        write(items.map { if (it.id == id) updated else it })
        updated
    }
    fun delete(id: String) = synchronized(lock) {
        val image = photoFile(id)
        val thumb = photoFile(id, true)
        val items = read()
        require(items.any { it.id == id }) { "Este recuerdo ya no esta disponible" }
        // Erase private image data before committing its removal from the catalog.
        Files.deleteIfExists(image.toPath()); Files.deleteIfExists(thumb.toPath())
        write(items.filterNot { it.id == id })
    }
}
