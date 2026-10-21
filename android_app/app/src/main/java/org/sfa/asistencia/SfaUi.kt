package org.sfa.asistencia

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

val SfaInk = Color(0xFF142D35)
val SfaMuted = Color(0xFF526573)
val SfaBorder = Color(0xFFE2E8F0)
val SfaTeal = Color(0xFF0D9488)
val SfaPale = Color(0xFFF0FDFA)
val SfaOrange = Color(0xFFEA580C)

@Composable
fun SfaTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = lightColorScheme(primary = SfaTeal, onPrimary = Color.White,
        primaryContainer = Color(0xFFCCFBF1), onPrimaryContainer = Color(0xFF115E59),
        secondary = Color(0xFF0F766E), secondaryContainer = SfaPale, onSecondaryContainer = Color(0xFF115E59),
        background = Color(0xFFF8FAFC), onBackground = SfaInk, surface = Color.White, onSurface = SfaInk,
        surfaceVariant = Color(0xFFF1F5F9), onSurfaceVariant = SfaMuted, outline = Color(0xFF94A3B8),
        outlineVariant = SfaBorder, error = SfaOrange),
        shapes = Shapes(extraSmall = RoundedCornerShape(6.dp), small = RoundedCornerShape(8.dp),
            medium = RoundedCornerShape(8.dp), large = RoundedCornerShape(12.dp), extraLarge = RoundedCornerShape(16.dp)),
        typography = Typography(
            headlineSmall = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.Bold, fontSize = 25.sp, lineHeight = 31.sp, letterSpacing = 0.sp),
            titleLarge = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 21.sp, lineHeight = 27.sp, letterSpacing = 0.sp),
            titleMedium = TextStyle(fontFamily = FontFamily.SansSerif, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, lineHeight = 23.sp, letterSpacing = 0.sp),
            bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 24.sp, letterSpacing = 0.sp),
            bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 21.sp, letterSpacing = 0.sp),
            bodySmall = TextStyle(fontSize = 12.sp, lineHeight = 18.sp, letterSpacing = 0.sp),
            labelLarge = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 15.sp, lineHeight = 21.sp, letterSpacing = 0.sp),
            labelMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 12.sp, lineHeight = 16.sp, letterSpacing = 0.sp)
        ), content = content)
}

@Composable
fun SfaBrand() {
    Surface(color = Color.White, tonalElevation = 0.dp) {
        Row(Modifier.fillMaxWidth().statusBarsPadding().padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Image(painterResource(R.drawable.logo_sfa), "SFA Asistencia", Modifier.size(44.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("SFA", fontWeight = FontWeight.Bold, fontSize = 19.sp, color = SfaInk)
                    Text("Asistencia", fontFamily = FontFamily.Serif, fontStyle = FontStyle.Italic, fontSize = 25.sp, color = Color(0xFF0F766E))
                }
                Text("Cuidado y tranquilidad", style = MaterialTheme.typography.bodySmall, color = SfaMuted)
            }
        }
    }
    HorizontalDivider(color = SfaBorder)
}

@Composable
fun SfaHeading(title: String, subtitle: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(title, style = MaterialTheme.typography.headlineSmall)
        if (subtitle != null) Text(subtitle, style = MaterialTheme.typography.bodyMedium, color = SfaMuted)
    }
}

@Composable
fun SfaSection(title: String, icon: ImageVector? = null, trailing: @Composable (() -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(9.dp)) {
        if (icon != null) Icon(icon, null, Modifier.size(20.dp), tint = Color(0xFF0F766E))
        Text(title, Modifier.weight(1f), style = MaterialTheme.typography.titleMedium)
        trailing?.invoke()
    }
}

@Composable
fun SfaBadge(text: String, active: Boolean = false) {
    Surface(color = if (active) SfaPale else Color(0xFFF1F5F9), shape = RoundedCornerShape(6.dp),
        border = BorderStroke(1.dp, if (active) Color(0xFF99E2D8) else SfaBorder)) {
        Row(Modifier.padding(horizontal = 9.dp, vertical = 5.dp), horizontalArrangement = Arrangement.spacedBy(5.dp), verticalAlignment = Alignment.CenterVertically) {
            if (active) Icon(Icons.Outlined.CheckCircle, null, Modifier.size(14.dp), tint = Color(0xFF0F766E))
            Text(text, color = if (active) Color(0xFF0F766E) else SfaMuted, style = MaterialTheme.typography.labelMedium)
        }
    }
}

@Composable
fun SfaButton(text: String, icon: ImageVector, onClick: () -> Unit, enabled: Boolean = true,
              secondary: Boolean = false, danger: Boolean = false) {
    val modifier = Modifier.fillMaxWidth().heightIn(min = 52.dp)
    val content: @Composable RowScope.() -> Unit = {
        Icon(icon, null, Modifier.size(20.dp)); Spacer(Modifier.width(10.dp))
        Text(text, Modifier.weight(1f, fill = false), style = MaterialTheme.typography.labelLarge, textAlign = TextAlign.Center)
    }
    if (secondary) OutlinedButton(onClick, modifier, enabled = enabled, shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, if (enabled) Color(0xFFA8CFCB) else SfaBorder),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp), content = content)
    else Button(onClick, modifier, enabled = enabled, shape = RoundedCornerShape(8.dp),
        colors = ButtonDefaults.buttonColors(containerColor = if (danger) SfaOrange else SfaTeal),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp), content = content)
}

@Composable
fun SfaChoice(title: String, subtitle: String?, icon: ImageVector, selected: Boolean, enabled: Boolean, onClick: () -> Unit) {
    Surface(color = if (selected) SfaPale else Color.White, shape = RoundedCornerShape(8.dp),
        border = BorderStroke(1.dp, if (selected) SfaTeal else SfaBorder)) {
        Row(Modifier.fillMaxWidth().selectable(selected = selected, enabled = enabled, role = Role.RadioButton, onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 13.dp), verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Icon(icon, null, Modifier.size(22.dp), tint = if (enabled) Color(0xFF0F766E) else SfaMuted)
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(title, style = MaterialTheme.typography.labelLarge, color = if (enabled) SfaInk else SfaMuted)
                if (subtitle != null && subtitle.isNotBlank()) Text(subtitle, style = MaterialTheme.typography.bodySmall, color = SfaMuted)
            }
            RadioButton(selected, onClick = null, enabled = enabled, modifier = Modifier.size(24.dp))
        }
    }
}

@Composable
fun SfaMetric(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(5.dp)) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = SfaMuted)
        Text(value, style = MaterialTheme.typography.titleMedium)
    }
}
