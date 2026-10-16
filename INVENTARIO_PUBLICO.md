# Inventario público

El repositorio contiene:

- `README.md`: presentación general.
- `AUTORIA.md`: declaración de autoría.
- `LICENCIA_DE_USO_RESTRINGIDO.md`: condiciones de uso.
- `RELEASES.md`: registro de versiones y comprobación del paquete.
- `.gitignore`: exclusión de datos privados, dependencias y compilaciones.
- `arduino/`: firmware principal y diagnóstico del MPU6050.
- `servidor_pc/`: API, puente serial, persistencia y gestión LAN.
- `interfaz_web/src/` y `public/`: interfaz editable y recursos gráficos.
- `interfaz_web/package*.json`, `tsconfig*.json`, `vite.config.ts`, `index.html`: dependencias y configuración web.
- `tests/`: pruebas unitarias de red local.
- `iniciar_interfaz.bat`, `iniciar_acceso_movil.bat`, `detener_interfaz.bat`: inicio/parada desde fuentes en Windows.
- `sfa_portable.py`, `SFA_Asistencia.spec`: lanzador y empaquetado.
- `docs/STACK_TECNOLOGICO.md`: tecnologías, herramientas y Mermaid.
- `docs/DESARROLLO.md`: instalación, ejecución, pruebas y construcción.
- `docs/HARDWARE_Y_PROTOCOLO.md`: cableado y comunicación del cinturón.
- `docs/VALIDACION_FUENTES.md`: comprobaciones de la publicación de fuentes.
- `docs/GALERIA.md`: pantallas y opciones de la versión preparada.
- `docs/VALIDACION.md`: pruebas y límites de compatibilidad.
- `docs/capturas/*.png`: capturas con datos ficticios.

El ejecutable portable se distribuye como un archivo adjunto de GitHub Releases.
No se publican bases de datos, credenciales, fotos personales, copias privadas,
entornos virtuales, `node_modules` ni logs. Las capturas usan datos ficticios.
Las compilaciones se regeneran desde las fuentes.
