# Desarrollo Desde el Código Fuente

## Requisitos

- Windows para los BAT y para reproducir el empaquetado del portable.
- Python 3.13, con lanzador `py` y Tcl/Tk para la ventana del portable.
- Node.js con npm. Esta publicación se comprueba con Node 24.
- Git o descarga del ZIP de fuentes desde GitHub.
- Editor como VS Code; Arduino IDE para modificar/cargar el cinturón.

No hace falta XAMPP, PHP, MySQL ni un servicio en la nube. La primera instalación
necesita Internet para descargar paquetes. No copies `.venv313` ni `node_modules`
de otra PC: se generan localmente.

## Obtener el Proyecto

```powershell
git clone https://github.com/hfreedo/SFA-Asistencia-Anticaidas.git
cd SFA-Asistencia-Anticaidas
```

Los siguientes comandos parten de esa carpeta y usan rutas relativas.

## Preparar Python

```powershell
py -3.13 -m venv .venv313
.\.venv313\Scripts\python.exe -m pip install -r .\servidor_pc\requirements.txt
```

Los paquetes quedan dentro de esta copia del proyecto. No hace falta activar el
entorno: se usa explícitamente su intérprete.

## Compilar Primero la Interfaz

```powershell
cd interfaz_web
npm ci
npm run build
cd ..
```

`npm ci` utiliza el archivo de bloqueo publicado. El build verifica TypeScript y
genera `interfaz_web/static`, que no se versiona. Si omites este paso, el servidor
no tendrá la interfaz compilada para servir.

## Iniciar

```powershell
.\.venv313\Scripts\python.exe -m uvicorn servidor_pc.main:app --host 127.0.0.1 --port 8780
```

Abre `http://127.0.0.1:8780`. Detén con `Ctrl+C` en esa terminal.
Después de compilar la interfaz también puedes usar `iniciar_interfaz.bat`.
El BAT prepara/verifica Python y sus paquetes; no compila React.

`detener_interfaz.bat` termina el proceso que escucha en 8780: úsalo solo si ese
puerto corresponde a SFA. `Ctrl+C` en su terminal es más específico.

## Conectar Arduino

1. Carga el [firmware principal](HARDWARE_Y_PROTOCOLO.md).
2. Cierra el Monitor Serie para liberar el puerto.
3. En Ajustes > Dispositivo selecciona el puerto real.
4. Usa 115200 baudios por USB o 9600 para HC-06.

HC-06 utiliza Bluetooth clásico serial, no BLE. Debe estar emparejado y disponer
de un puerto serie del sistema. La página no utiliza Web Bluetooth.

## Editar con Recarga en Vivo

Con el backend de 8780 activo, abre otra terminal:

```powershell
cd interfaz_web
npm run dev
```

Abre `http://127.0.0.1:5173/static/`. Vite reenvía `/api` y `/ws` a Python en 8780.
Este modo no es el portable ni el acceso LAN. Al terminar los cambios, ejecuta
`npm run build` para actualizar la web que sirve FastAPI.

## Celular y QR

Detén el modo local y ejecuta `iniciar_acceso_movil.bat` desde la raíz. Conecta
PC y celular a la misma red o utiliza un hotspot compartido. En Ajustes > Acceso
móvil selecciona la red del celular si aparece más de una y escanea el QR con
la cámara. No es necesario escribir direcciones.

Si falla, revisa red seleccionada, aislamiento del router y permiso de Python
en redes privadas del firewall. No desactives todo el firewall. El modo LAN no
tiene autenticación: no lo expongas a Internet. La PC debe seguir encendida.

## Pruebas

Desde la raíz:

```powershell
.\.venv313\Scripts\python.exe -m unittest discover -s tests -v
```

Las pruebas actuales comprueban descubrimiento de red/hotspot y cierre de sockets
ante un fallo parcial. No son cobertura completa ni una validación de caídas reales.

## Construir el EXE Windows

Primero compila la interfaz. Luego, desde la raíz:

```powershell
.\.venv313\Scripts\python.exe -m pip install pyinstaller
.\.venv313\Scripts\python.exe -m PyInstaller --clean --noconfirm SFA_Asistencia.spec
```

El resultado es `dist/SFA_Asistencia.exe`. El spec deriva las rutas desde su
ubicación y no contiene rutas personales del autor. Construye el EXE, no el ZIP
completo del release con driver, licencias e instrucciones. PyInstaller es una
herramienta de construcción separada sin versión fijada aquí: no se garantiza
reproducción byte a byte. El portable Windows se construye y prueba en Windows.

## Archivos Para Orientarse

| Ruta | Contenido |
| --- | --- |
| `arduino/SFA_Cinturon_Alerta/` | Firmware principal |
| `arduino/Test_MPU6050/` | Diagnóstico independiente |
| `servidor_pc/main.py` | API, puente serial, WebSocket y SQLite |
| `servidor_pc/red_local.py` | IP y sockets LAN |
| `servidor_pc/acceso_movil.py` | Inicio en red local |
| `interfaz_web/src/SfaDashboard.tsx` | Vistas, formularios, alertas y QR |
| `interfaz_web/src/index.css` | Estilos propios |
| `interfaz_web/vite.config.ts` | Build y proxy de desarrollo |
| `sfa_portable.py` | Ventana de inicio |
| `SFA_Asistencia.spec` | Empaquetado |

## Datos y Recursos Privados

Desde fuentes se crea `servidor_pc/sfa_eventos.sqlite3`. El portable crea
`data/sfa_eventos.sqlite3` junto al EXE. Las fuentes públicas no incluyen perfiles,
fotografías personales ni tokens. El token de Telegram configurado queda en la
base local: protege ese archivo.

La exportación JSON omite credenciales e historial; una copia completa de la base
sí puede contenerlos. No la adjuntes a commits, issues o capturas. Revisa siempre
`git diff --cached` y no fuerces archivos privados con `git add -f`.

Las bibliotecas y fuentes mantienen sus licencias de terceros. Los logotipos y
el símbolo retocado no se convierten en recursos libres por publicarse aquí;
el retoque no sustituye los permisos del original.
