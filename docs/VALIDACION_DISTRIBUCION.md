# Validación de la Preparación de Distribución

Fecha: 2026-10-22. No se publicaron binarios nuevos en esta etapa.

| Comprobación | Resultado |
| --- | --- |
| Python: `unittest discover -s tests -q` | 95 pruebas aprobadas, incluidas 5 de distribución |
| Android: pruebas unitarias, assembleDebug y lintDebug | Build aislado aprobado |
| Android: validación sin clave release | Rechazo esperado: faltan las cuatro variables de firma |
| Android: assembleRelease sin clave | Se detiene en validateReleaseSigning, antes de generar una APK |
| Script PowerShell de firma | Sintaxis analizada sin errores |
| README | Enlaces locales e imágenes existentes verificados |
| Entrega de revisión | 51 archivos comprobados contra manifiesto SHA-256 |
| Paquetes de entrada | Hashes de Windows rc8 y Android 0.6.1 coinciden con los publicados anteriormente |
| ZIP Windows | Integridad y nombres de entradas comprobados; rechazo de rutas inseguras y artefactos privados cubierto por pruebas |
| Copia pública local | Diff sin errores de espacios; no se modificó la licencia ni la visibilidad |

La suite Python emitió avisos de deprecación del adaptador WebSocket y avisos
de conexiones SQLite sin cerrar durante pruebas. No hubo fallos de aserción;
esos avisos no se consideran resueltos por este trabajo.

## Lo que todavía no se ha validado

- Creación de la clave de distribución y compilación de una APK release firmada.
- Identidad del certificado definitivo y continuidad entre dos versiones release.
- Instalación, GPS, SOS y FCM de ese nuevo candidato en Android físico.
- Aparición o ausencia de avisos en distintos navegadores y dispositivos: no
  puede deducirse de una compilación correcta.
- Compatibilidad general en cualquier PC: esta entrega copia binarios existentes,
  no repite una prueba física en Windows 10 u otro equipo.
- Inventario completo de licencias de dependencias, driver y recursos gráficos.

No se cambiaron configuraciones de Supabase, Firebase, firewall o confianza de
certificados. No se detuvo el Centro activo ni se abrieron servidores para
probar la entrega. No se inscribió el proyecto en servicios de pago o pruebas.
