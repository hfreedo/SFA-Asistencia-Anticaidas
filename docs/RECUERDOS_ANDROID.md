# Recuerdos en Android

Disponible desde Android 0.7.0-release. Es un album personal del celular,
independiente del cinturon y de la sesion de Supabase.

## Uso

1. Abre **Recuerdos** en la navegacion inferior.
2. Pulsa **Anadir foto** y elige una imagen con el selector de Android.
3. Abre la foto para verla completa, recorrer el album, editar su titulo o
   marcarla como favorita. El titulo es opcional.
4. **Quitar del album** pide confirmacion y elimina solo la copia de SFA.

No hay reproduccion automatica. Las fotos elegidas y sus miniaturas quedan
guardadas dentro de la app y pueden verse sin internet despues de importarlas.
El proveedor elegido en el selector puede necesitar internet si la imagen
original esta en un servicio externo.

## Privacidad y limites

- No se suben fotos a Supabase, Firebase, la PC o cuidadores. No hay administracion
  remota del album ni reconocimiento facial.
- El selector concede acceso a la imagen elegida; no se piden permisos nuevos
  para leer toda la galeria. Las originales no se modifican.
- Se crea una copia JPEG optimizada de hasta 1600 pixeles de lado mayor y una
  miniatura. No se copian los metadatos EXIF originales.
- Hasta 60 fotos, titulos de 100 caracteres y originales de hasta 20 MB.
- El album pertenece al dispositivo, no a cada cuenta. Cerrar sesion no lo
  borra; las personas que usen ese telefono desbloqueado pueden abrirlo.
- Desinstalar SFA o borrar sus datos elimina el album. No hay copia de seguridad
  automatica ni exportacion en esta etapa; conserva tus originales fuera de SFA.
- Quien ayude a elegir fotos debe contar con el consentimiento de la persona.
  La funcion no se presenta como tratamiento ni como evaluacion clinica.

## Convivencia con asistencia

La importacion y lectura de fotos se realizan en tareas de E/S independientes.
No detienen el servicio GPS, no cambian la vinculacion ni consumen la cola de
SOS. Si hay una persona vinculada por internet y una sesion activa, **Enviar
SOS** permanece en la barra inferior al abrir el album y su vista ampliada.
Se conservan el dialogo de confirmacion y los avisos del flujo existente.
Los incidentes del residente vinculado siguen apareciendo antes del album.

La persistencia del catalogo usa escrituras atomicas; un catalogo corrupto da
error y no se reemplaza por uno vacio. Las pruebas unitarias usan imagenes de
marcadores de prueba, no fotografias ni pruebas del decodificador Android.

## Prueba pendiente en un Android real

1. Actualiza desde la release 0.6.2 sin desinstalar: se conserva la misma firma.
   Si aun tienes una APK debug, consulta [la migracion](ANDROID_RELEASE.md).
2. Abre el album sin iniciar sesion y selecciona JPG, PNG o una foto tomada en
   vertical. Comprueba orientacion, vista completa y titulos largos.
3. Cambia titulo, marca favorita, cierra la app y vuelve a abrirla. Debe persistir.
4. Cancela el selector; no debe crearse un recuerdo vacio.
5. Elimina una foto y verifica que el original sigue en la galeria.
6. Prueba sin internet con fotos ya importadas y con el tamano de letra aumentado.
7. En un entorno de pruebas y con destinatarios avisados, verifica GPS y un SOS
   mientras Recuerdos esta abierto. No enviar emergencias reales como pruebas.

## Referencias

- [Selector de archivos y acceso elegido por el usuario](https://developer.android.com/training/data-storage/shared/documents-files).
- [Decodificacion de imagenes Android](https://developer.android.com/reference/android/graphics/ImageDecoder).
