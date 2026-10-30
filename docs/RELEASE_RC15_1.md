# Windows 1.2.0-rc15.1

## Novedades

- Preparacion recupera el vinculo de consulta existente de la cuenta. No exige
  elegir y confirmar otra vez una ficha ya vinculada y autorizada.
- Cambiar ficha sigue requiriendo una confirmacion explicita. Puede cancelarse
  sin modificar el vinculo anterior.
- Principal y mapa muestran la identidad remota y diferencian el perfil local.
  No presentan su foto, telefono o notas como si pertenecieran a otra persona.
- Consulta y avisos del navegador separados de la emision opcional de PC/FCM.
- Selector, etiquetas y acciones refinados para mantener el lenguaje visual SFA.
- Proxy de desarrollo compatible con HTTPS local validado mediante la CA propia.

## Actualizacion

Cerrar el Centro anterior y respaldar sus datos. Extraer el ZIP completo. Para
conservar la instalacion existente, reemplazar su ejecutable conservando data/,
.env y certificados propios. No sustituir datos existentes por una carpeta vacia.

Android recomendado: **0.7.3-release**, sin nueva APK para esta entrega. No cambia
el contrato GPS/SOS/FCM, ni requiere migraciones Supabase o nuevas credenciales.

## Verificacion y limites

153 pruebas web aprobadas y compilacion de panel y portal. Revision en navegador
interno a 1920 x 1080 CSS con cuenta cuidadora: consulta de GPS e incidentes,
recuperacion del vinculo y cancelacion de edicion sin guardado.

El permiso del navegador no demuestra recepcion de un aviso. No se emitieron SOS
ni pruebas push reales para publicar esta entrega. La validacion fisica Android,
la concurrencia integral entre sesiones y otras etapas del plan siguen pendientes.
Consultar docs/AVANCE_FLUJOS_Y_DISENO.md y docs/PLAN_FLUJOS_Y_DISENO.md.

Prototipo experimental de investigacion y desarrollo educativo.
