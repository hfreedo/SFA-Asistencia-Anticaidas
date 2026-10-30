# Etapa 2: portal de acceso y copia local

**Documento histórico de la etapa de acceso.** Para entrar y usar las funciones actuales consulta [Portal y Android](MANUAL_PORTAL_Y_ANDROID.md). El portal ya permite consulta, equipo, geocerca y atención; no se limita a validar usuarios.

## Alcance implementado

Portal React independiente con la identidad visual existente. Incluye login,
solicitud de recuperacion, establecimiento de contrasena al aceptar una
invitacion, cierre de sesion y consulta de los propios vinculos en Supabase.
No hay formulario de registro publico ni claves administrativas.

La etapa 3A agrega consulta de residentes, telemetria y eventos remotos, ademas
de vinculacion administradora desde la copia local. Consultar SINCRONIZACION.md.
No protege los endpoints LAN existentes con este login. No se debe exponer el
servidor local a internet pensando que el portal ya lo autentica.

## Dos accesos

| Variante | Direccion | Dependencias |
| --- | --- | --- |
| Portal HTTPS | https://hfreedo.github.io/SFA-Asistencia-Anticaidas/acceso.html | Internet, GitHub Pages y Supabase |
| Copia local | `/acceso/acceso.html` en el servidor SFA de esta PC | Servidor local y Supabase para autenticar |
| Monitoreo local existente | `/` en el servidor SFA | PC y cinturon; no necesita GitHub Pages para la telemetria local |

La copia local funciona si GitHub Pages cae, pero no reemplaza Supabase ni
permite login cloud sin internet. En el servidor HTTPS activo la direccion es
`https://localhost:8780/acceso/acceso.html`; requiere confiar su certificado
local. Con el iniciador HTTP habitual es
`http://localhost:8780/acceso/acceso.html`. La contrasena viaja directamente
por HTTPS a Supabase tambien cuando la pagina se sirve desde localhost.

El respaldo es para esta PC: localhost en un celular es el propio celular,
no la PC. No se configura acceso LAN HTTP para aceptar sesiones cloud.

En Ajustes > Acceso movil se agregaron ambos enlaces. No se crearon nuevos BAT.
El iniciador unificado sigue pendiente. La especificacion PyInstaller ahora
incluye el portal, pero no se reconstruyeron los EXE o ZIP de releases anteriores.

## Configuracion y construccion

1. Copiar `interfaz_web/.env.example` a `.env.acceso`.
2. Completar solo URL y clave `sb_publishable_...` del proyecto.
3. Ejecutar los siguientes comandos de desarrollo desde interfaz_web:

```powershell
npm ci
npm test
npm run build:access
npm run build
```

`build:access` genera dist-acceso sin copiar otros assets de public/.
Solo se incorporan el logo utilizado y los recursos necesarios. El build normal
del panel sigue generando static/. Las rutas nuevas se montan al iniciar el
servidor. No es necesario cambiar sus dependencias Python.

La politica CSP de acceso.html permite conectar solo al proyecto de pruebas
actual; si se cambia de proyecto hay que actualizar tambien connect-src.
No agregar origenes genericos ni claves elevadas para resolver errores.

## Publicacion

Se habilito GitHub Pages sobre la rama `codex/portal-acceso`, sin reemplazar
una pagina previa. La rama contiene solo el resultado estatico; no se publico
la base SQLite, perfiles, fotos de residentes, .env o claves secretas. La rama
main y los releases no se actualizaron en esta etapa.

```powershell
.\.venv313\Scripts\python.exe scripts/publicar_portal.py
# Solo con autorizacion para publicar:
.\.venv313\Scripts\python.exe scripts/publicar_portal.py --publish
```

El primer comando inspecciona el paquete. El segundo crea un commit y hace
push sin forzar sobre la rama especifica. GitHub Pages debe estar configurado
para esa rama. Una ejecucion no fuerza ni sobrescribe main.

## Seguridad y limites

- Las sesiones usan sessionStorage, no almacenamiento persistente de contrasenas.
- El SDK procesa los enlaces Auth; getUser comprueba identidad con Supabase
  antes de mostrar los vinculos. La informacion no se autoriza por un rol del frontend.
- La base aplica RLS y bloquea escrituras directas. La etapa 3A permite comandos
  RPC de vinculacion y envio solo para administradores del espacio correspondiente.
- Errores de credenciales se muestran sin detalles internos; recuperacion usa
  respuesta generica para no confirmar la existencia de cuentas.
- Se eliminan contrasenas de los inputs tras la solicitud y no se registran en logs.
- Los enlaces de retorno se construyen en el mismo origen, sin reutilizar next
  ni parametros recibidos. No se permiten comodines en la lista de retorno prevista.
- La aplicacion no presenta el formulario si esta embebida en un iframe.
- Referrer-Policy mediante meta no-referrer y CSP restringida; no hay analitica
  ni scripts externos. Esto no sustituye una auditoria de seguridad.
- Conservar historial de ubicacion no implica incorporarlo al portal publico.
- GitHub Pages de una misma cuenta comparte origen entre repositorios. Para
  una entrega productiva conviene un dominio dedicado y cabeceras de seguridad
  controlables, junto con reautenticacion/MFA para operaciones sensibles.
- El acceso real requiere que el usuario defina su propia contrasena. El agente
  no la solicita, establece ni prueba con conocimiento de ella.

## Validacion y siguientes pasos

Pruebas de politica y componentes con SDK simulado; pruebas HTTP de archivos
y rutas del respaldo local en un servidor con base temporal. Ambas compilaciones
TypeScript/Vite verificadas. Vista publicada inspeccionada en navegador, logo
cargado y sin desbordamiento horizontal a 390 px. Eso no prueba login real.

Los destinos exactos ya fueron autorizados y configurados. Supabase confirmo
el envio de la invitacion y la membresia administradora quedo activa; consultar
SUPABASE_ESTADO.md. El titular confirmo que acepto y establecio su clave.
El login con rol administrador y la vinculacion local fueron comprobados con
el titular. Falta el recorrido de lecturas reales del cinturon hasta el portal.
Las pruebas con SDK simulado no sustituyen esa comprobacion fisica.
