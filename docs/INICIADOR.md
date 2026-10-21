# Centro de inicio SFA

Entrega actual: **1.2.0-rc4**. Empezar por `ABRIR_AQUI.md` en la raiz.
Los BAT avanzados se agruparon en `herramientas/compatibilidad/`; no son necesarios
para abrir normalmente el sistema. GPS Android remoto usa internet y no requiere
activar HTTPS local. Esa opcion del iniciador sigue disponible para el modo LAN.

Abrir el acceso directo `SFA Asistencia.lnk` de la raiz, que apunta a
`dist/SFA_Centro.exe`. Es el unico ejecutable de uso normal en dist; los binarios
de compilacion estan en dist/rc4. Incluye botones para iniciar y detener su
servidor, abrir el panel local, acceder a sincronizacion y abrir el portal
remoto. Cerrar la ventana pide confirmar la detencion del servidor propio.

Si detecta otro servidor SFA, habilita los accesos sin iniciar un segundo
servidor. Detener puede solicitar el cierre ordenado de otra instancia SFA
actualizada de la misma cuenta Windows. Usa una capacidad aleatoria local,
validada desde loopback; no mata procesos por nombre ni permite control LAN.
Las instancias antiguas sin ese mecanismo necesitan reiniciarse una vez.
El iniciador impide una segunda ventana para la misma carpeta y puerto.
Dos procesos de PyInstaller pueden corresponder a una sola ventana; eso no
implica dos servidores. La detencion espera hasta cinco segundos las conexiones
activas antes de cancelarlas y completar el cierre del servidor.

El servidor propio usa HTTP en localhost; no requiere certificados para el
panel y el login local. Supabase sigue recibiendo credenciales y datos por HTTPS.
Al marcar Celular y ubicacion, el centro prepara/verifica certificados y sirve
HTTPS en loopback y las direcciones LAN. Si cambia la red, renueva el certificado
del servidor conservando la CA. El EXE utiliza cryptography incorporado; las
fuentes pueden usar OpenSSL con alternativa nativa si falta. No instala confianza ni modifica el
firewall silenciosamente. El boton de ayuda explica Android y abre la carpeta
del certificado publico. Cada equipo debe confiar la CA. La vinculacion web
actual requiere misma red/hotspot y pagina abierta; no es rastreo remoto Android.

## Datos

Dentro del proyecto, fuentes y EXE usan `servidor_pc/sfa_eventos.sqlite3`.
La deteccion busca marcadores del proyecto desde la ubicacion del ejecutable,
no desde la carpeta de trabajo. Fuera del proyecto, el portable usa
`data/sfa_eventos.sqlite3` junto al EXE. No se fusionan bases silenciosamente
ni se reemplazan perfiles locales por el directorio cloud. Las bases anteriores
se conservaron y respaldaron en copias_privadas.
Si se conecta a un servidor existente, utiliza los datos de ese servidor.
La ventana distingue ambos casos. No copiar bases mientras se estan escribiendo;
usar exportacion o una copia consistente SQLite para una migracion posterior.

Los BAT de soporte mantienen deteccion relativa de la raiz tras su reubicacion.
Las pruebas del iniciador comprueban apertura de las rutas mediante navegador
simulado, inicio/detencion/reinicio en puerto y base temporales, y que un
servidor externo no se pueda detener accidentalmente.
