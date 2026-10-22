# Recursos de distribucion

`recursos/Driver_CH340_CH341/` y `recursos/Licencias/` son las copias verificadas
del driver opcional y licencias del release anterior. Se mantienen fuera de
los directorios de versiones antiguas para que archivar entregas no impida crear
la siguiente. El driver no forma parte del programa Python/Android.

En una clonacion publica, extraer esas dos carpetas del ZIP de un release
verificado antes de empaquetar. Para rc6 usar `scripts/preparar_release_incidentes.py`
despues de compilar el EXE en `dist/persistent-incidents/`; el script anterior
`preparar_release_actual.py` reproduce exclusivamente rc5. No hacen falta
para ejecutar pruebas, compilar la APK o compilar el EXE con PyInstaller.
