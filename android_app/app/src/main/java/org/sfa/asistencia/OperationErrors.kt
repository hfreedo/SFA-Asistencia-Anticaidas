package org.sfa.asistencia

import java.io.IOException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import javax.net.ssl.SSLException

/** User-facing categories only; never include server bodies, credentials or exception messages. */
fun operationErrorMessage(error: Exception): String = when (error) {
    is ApiFailure -> when (error.status) {
        400 -> "El servidor no aceptó la solicitud. Revisa la selección; si es una prueba de alarma, espera un minuto. [HTTP-400]"
        401 -> "La sesión venció. Vuelve a iniciar sesión en Cuidar. [HTTP-401]"
        403 -> "Tu cuenta no tiene permiso para esta operación o el vínculo fue revocado. [HTTP-403]"
        404 -> "La función no está disponible para esta sesión en el servidor. [HTTP-404]"
        429 -> "Hay demasiadas solicitudes. Espera un minuto antes de repetir. [HTTP-429]"
        in 500..599 -> "El servidor no pudo responder. Espera y vuelve a intentarlo. [HTTP-${error.status}]"
        else -> "El servidor rechazó la operación. [HTTP-${error.status}]"
    }
    is SocketTimeoutException -> "La conexión tardó demasiado. Prueba con datos móviles o con otra red y vuelve a seleccionar la persona. No es un permiso de GPS. [RED-TIEMPO]"
    is UnknownHostException -> "No se pudo encontrar el servidor. Revisa internet, DNS o una VPN que pueda bloquearlo. [RED-DNS]"
    is SSLException -> "No se pudo verificar la conexión segura. Revisa la fecha y hora del celular y prueba otra red. No desactives la seguridad. [RED-TLS]"
    is SecurityException -> "Android bloqueó un permiso de la operación. Revisa los permisos de SFA en Ajustes del celular. [ANDROID-PERMISO]"
    is IOException -> "Se interrumpió la conexión. Prueba con datos móviles u otra red y vuelve a intentarlo. [RED-CONEXION]"
    else -> "La app no pudo procesar la respuesta. Informa qué acción realizaste. [APP-RESPUESTA]"
}
