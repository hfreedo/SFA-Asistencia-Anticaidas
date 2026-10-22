package org.sfa.asistencia

import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.io.File

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MemoryAlbum(notice: (String) -> Unit) {
    val context = LocalContext.current
    val store = remember(context) { MemoryImages.catalog(context) }
    val scope = rememberCoroutineScope()
    var photos by remember { mutableStateOf<List<MemoryPhoto>>(emptyList()) }
    var loaded by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var selected by rememberSaveable { mutableStateOf<String?>(null) }
    var favorites by rememberSaveable { mutableStateOf(false) }
    var edit by remember { mutableStateOf<MemoryPhoto?>(null) }
    var title by remember { mutableStateOf("") }
    var deleting by remember { mutableStateOf<MemoryPhoto?>(null) }
    var privacy by remember { mutableStateOf(false) }
    LaunchedEffect(store) {
        try { photos = withContext(Dispatchers.IO) { store.list() }; loaded = true }
        catch (failure: Exception) { if (failure is CancellationException) throw failure; error = "No se pudo abrir el álbum. Tus archivos no se han reemplazado." }
    }
    fun work(success: String, action: () -> Unit) {
        if (busy) return
        busy = true; error = ""
        scope.launch {
            try {
                photos = withContext(Dispatchers.IO) { action(); store.list() }
                loaded = true
                notice(success)
            } catch (failure: Exception) {
                if (failure is CancellationException) throw failure
                error = failure.message ?: "No se pudo guardar el cambio"
            } finally { busy = false }
        }
    }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) work("Foto guardada en Recuerdos") { MemoryImages.importPhoto(context, uri, store) }
    }
    val visible = photos.filter { !favorites || it.favorite }
    val current = visible.firstOrNull { it.id == selected }
    LaunchedEffect(photos, favorites, loaded) {
        if (loaded && selected != null && visible.none { it.id == selected }) selected = null
    }
    BackHandler(enabled = selected != null) { selected = null }
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Column(Modifier.weight(1f)) { SfaHeading("Recuerdos"); Text("En este celular", color = SfaMuted, style = MaterialTheme.typography.bodyMedium) }
        IconButton(onClick = { privacy = true }) { Icon(Icons.Outlined.Info, "Privacidad del álbum") }
    }
    if (error.isNotBlank()) Surface(color = Color(0xFFFFF7ED), shape = RoundedCornerShape(8.dp)) {
        Text(error, Modifier.padding(14.dp), color = Color(0xFF9A3412))
    }
    if (!loaded && error.isNotBlank()) SfaButton("Reintentar", Icons.Outlined.Refresh, { work("Álbum abierto") {} }, !busy, secondary = true)
    if (busy) LinearProgressIndicator(Modifier.fillMaxWidth())
    if (current == null) {
        SfaButton("Añadir foto", Icons.Outlined.AddPhotoAlternate, { picker.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, loaded && !busy && photos.size < MemoryCatalog.LIMIT)
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            SegmentedButton(selected = !favorites, onClick = { favorites = false }, shape = SegmentedButtonDefaults.itemShape(0, 2)) { Text("Todas (${photos.size})") }
            SegmentedButton(selected = favorites, onClick = { favorites = true }, shape = SegmentedButtonDefaults.itemShape(1, 2)) { Text("Favoritas (${photos.count { it.favorite }})") }
        }
        if (photos.size >= MemoryCatalog.LIMIT) Text("Álbum completo · ${MemoryCatalog.LIMIT} fotos", style = MaterialTheme.typography.bodyMedium, color = SfaMuted)
        if (loaded && visible.isEmpty()) {
            Column(Modifier.fillMaxWidth().padding(vertical = 28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Icon(Icons.Outlined.PhotoLibrary, null, Modifier.size(44.dp), tint = SfaTeal)
                Text(if (favorites) "Aún no hay favoritas" else "Tu álbum empieza aquí", style = MaterialTheme.typography.titleLarge)
            }
        }
        for (row in visible.chunked(2)) Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            for (photo in row) key(photo.id) { Card(onClick = { selected = photo.id }, modifier = Modifier.weight(1f), shape = RoundedCornerShape(8.dp), border = BorderStroke(1.dp, SfaBorder), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                MemoryImage(store.photoFile(photo.id, true), photo.title.ifBlank { "Recuerdo" }, Modifier.fillMaxWidth().aspectRatio(4f / 3f), true)
                Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(photo.title.ifBlank { "Sin título" }, Modifier.weight(1f), style = MaterialTheme.typography.labelLarge, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    if (photo.favorite) Icon(Icons.Outlined.Favorite, "Favorita", Modifier.size(18.dp), tint = SfaTeal)
                }
            } }
            if (row.size == 1) Spacer(Modifier.weight(1f))
        }
    } else {
        SfaButton("Volver al álbum", Icons.Outlined.ArrowBack, { selected = null }, secondary = true)
        key(current.id) { MemoryImage(store.photoFile(current.id), current.title.ifBlank { "Recuerdo" }, Modifier.fillMaxWidth().aspectRatio(4f / 5f), false) }
        Text(current.title.ifBlank { "Sin título" }, style = MaterialTheme.typography.titleLarge)
        val index = visible.indexOfFirst { it.id == current.id }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            FilledTonalIconButton(onClick = { selected = visible[index - 1].id }, enabled = index > 0, modifier = Modifier.size(52.dp)) { Icon(Icons.Outlined.ChevronLeft, "Foto anterior") }
            Text("${index + 1} de ${visible.size}", style = MaterialTheme.typography.bodyMedium, color = SfaMuted)
            FilledTonalIconButton(onClick = { selected = visible[index + 1].id }, enabled = index < visible.lastIndex, modifier = Modifier.size(52.dp)) { Icon(Icons.Outlined.ChevronRight, "Foto siguiente") }
        }
        SfaButton(if (current.favorite) "Quitar de favoritas" else "Guardar en favoritas", Icons.Outlined.FavoriteBorder, { work("Favoritas actualizadas") { store.update(current.id, current.title, !current.favorite) } }, !busy, secondary = true)
        SfaButton("Editar título", Icons.Outlined.Edit, { title = current.title; edit = current }, !busy, secondary = true)
        SfaButton("Quitar del álbum", Icons.Outlined.DeleteOutline, { deleting = current }, !busy, secondary = true)
    }
    if (privacy) AlertDialog(onDismissRequest = { privacy = false }, title = { Text("Tu álbum privado") }, text = { Text("Las fotos se copian en este celular. No se envían a SFA, Supabase ni a cuidadores. Las originales de tu galería no se modifican. Las copias del álbum se pierden al desinstalar SFA o borrar sus datos; no hay copia de seguridad automática.") }, confirmButton = { TextButton(onClick = { privacy = false }) { Text("Entendido") } })
    edit?.let { photo -> AlertDialog(onDismissRequest = { edit = null }, title = { Text("Título del recuerdo") }, text = {
        OutlinedTextField(value = title, onValueChange = { title = it.take(MemoryCatalog.TITLE_LIMIT) }, label = { Text("Título opcional") }, supportingText = { Text("${title.length}/${MemoryCatalog.TITLE_LIMIT}") }, modifier = Modifier.fillMaxWidth(), maxLines = 3)
    }, confirmButton = { TextButton(enabled = !busy, onClick = { edit = null; work("Título guardado") { store.update(photo.id, title, photo.favorite) } }) { Text("Guardar") } }, dismissButton = { TextButton(onClick = { edit = null }) { Text("Cancelar") } }) }
    deleting?.let { photo -> AlertDialog(onDismissRequest = { deleting = null }, title = { Text("Quitar este recuerdo") }, text = { Text("Se eliminará la copia de Recuerdos. La foto original de tu galería se conserva.") }, confirmButton = { TextButton(enabled = !busy, onClick = { deleting = null; work("Foto quitada del álbum") { store.delete(photo.id) }; selected = null }) { Text("Quitar") } }, dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancelar") } }) }
}

@Composable
private fun MemoryImage(file: File, description: String, modifier: Modifier, thumbnail: Boolean) {
    var finished by remember(file.path) { mutableStateOf(false) }
    var bitmap by remember(file.path) { mutableStateOf<ImageBitmap?>(null) }
    LaunchedEffect(file.path) {
        try {
            val decoded = withContext(Dispatchers.IO) { MemoryImages.decode(file, if (thumbnail) 256 else 1600).asImageBitmap() }
            bitmap = decoded
        } catch (failure: Exception) {
            if (failure is CancellationException) throw failure
            bitmap = null
        } finally { finished = true }
    }
    Box(modifier.background(Color(0xFFF1F5F9)), contentAlignment = Alignment.Center) {
        if (bitmap != null) Image(bitmap!!, description, Modifier.fillMaxSize(), contentScale = if (thumbnail) ContentScale.Crop else ContentScale.Fit)
        else if (!finished) CircularProgressIndicator(Modifier.size(24.dp))
        else Icon(Icons.Outlined.Photo, "Foto no disponible", Modifier.size(36.dp), tint = SfaMuted)
    }
}
