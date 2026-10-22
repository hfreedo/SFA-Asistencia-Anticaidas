package org.sfa.asistencia

import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageDecoder
import android.net.Uri
import java.io.ByteArrayOutputStream
import java.io.File
import kotlin.math.max
import kotlin.math.roundToInt

object MemoryImages {
    fun catalog(context: Context) = MemoryCatalog(context.noBackupFilesDir.resolve("memories"))
    fun importPhoto(context: Context, uri: Uri, store: MemoryCatalog): MemoryPhoto {
        val temporary = File.createTempFile("memory-", ".image", context.cacheDir)
        try {
            val stream = context.contentResolver.openInputStream(uri) ?: error("No se pudo abrir la foto")
            stream.use { input -> temporary.outputStream().use { output ->
                val buffer = ByteArray(8192)
                var total = 0
                while (true) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    total += count
                    require(total <= 20 * 1024 * 1024) { "Elige una foto de menos de 20 MB" }
                    output.write(buffer, 0, count)
                }
            } }
            val bitmap = decode(temporary, 1600)
            try {
                val width = max(1, (bitmap.width * 256f / max(bitmap.width, bitmap.height)).roundToInt())
                val height = max(1, (bitmap.height * 256f / max(bitmap.width, bitmap.height)).roundToInt())
                val thumb = Bitmap.createScaledBitmap(bitmap, width, height, true)
                try { return store.add(jpeg(bitmap, 88), jpeg(thumb, 82)) }
                finally { if (thumb !== bitmap) thumb.recycle() }
            } finally { bitmap.recycle() }
        } finally { temporary.delete() }
    }
    fun decode(file: File, longEdge: Int): Bitmap = ImageDecoder.decodeBitmap(ImageDecoder.createSource(file)) { decoder, info, _ ->
        require(info.size.width.toLong() * info.size.height <= 120_000_000) { "La foto tiene demasiados pixeles" }
        val factor = minOf(1f, longEdge.toFloat() / max(info.size.width, info.size.height))
        decoder.setTargetSize(max(1, (info.size.width * factor).roundToInt()), max(1, (info.size.height * factor).roundToInt()))
        decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
    }
    private fun jpeg(bitmap: Bitmap, quality: Int): ByteArray = ByteArrayOutputStream().use { output ->
        check(bitmap.compress(Bitmap.CompressFormat.JPEG, quality, output)) { "No se pudo preparar la foto" }
        output.toByteArray()
    }
}
