# Recursos de distribucion

## Entrega de revision actual

Abre `actual/LEEME.md` para los paquetes vigentes separados por plataforma.
Se genera con `scripts/preparar_entrega_actual.py`, verifica los hashes y no
modifica el Centro activo ni las entregas publicadas. Android sigue identificado
como debug hasta completar la firma propia de `docs/ANDROID_RELEASE.md`.
Consulta `docs/ORGANIZACION_Y_ENTREGA.md` antes de compartir o mover carpetas.

## Recursos para empaquetado

`recursos/Driver_CH340_CH341/` y `recursos/Licencias/` son las copias verificadas
del driver opcional y licencias del release anterior. Se mantienen fuera de
los directorios de versiones antiguas para que archivar entregas no impida crear
la siguiente. El driver no forma parte del programa Python/Android.

En una clonacion publica, extraer esas dos carpetas del ZIP de un release
verificado antes de empaquetar. Para rc8 usar `scripts/preparar_release_incidentes.py`
despues de compilar el EXE en `dist/navigation-push-tests/`; el script anterior
`preparar_release_actual.py` reproduce exclusivamente rc5. No hacen falta
para ejecutar pruebas, compilar la APK o compilar el EXE con PyInstaller.
