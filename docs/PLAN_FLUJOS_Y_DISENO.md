# Plan de mejora: acceso, preparacion y cuidado

Estado: propuesta pendiente de implementacion y validacion por etapas.
Fecha: 30 de octubre de 2026.

## 1. Objetivo y limites

Conseguir que cada cuenta pueda reconocer su rol, completar solo los requisitos
necesarios y comprobar el resultado sin aprender la arquitectura interna de SFA.
Un acceso correcto no significa GPS recibido, y un receptor registrado no significa
notificacion entregada. El diseno debe conservar esas diferencias sin saturar.

Este documento no certifica cambios implementados ni pruebas fisicas realizadas.
Los hallazgos de la auditoria de codigo deben reproducirse antes de corregirse.

### Condiciones que no se negocian

- Conservar cuentas, fichas, asignaciones, consentimientos e historiales existentes.
- No elevar permisos para evitar un error de configuracion.
- No cambiar automaticamente quien emite datos ni quien recibe acceso a una ficha.
- No iniciar GPS, habilitar notificaciones o emitir pruebas sin accion y consentimiento correspondientes.
- No cerrar incidentes por reconexion, reingreso a una zona o cambio de cuenta.
- No permitir administracion LAN para resolver problemas del panel local.
- No publicar claves privadas, sesiones, coordenadas o capturas de datos personales.
- No activar facturacion, pruebas renovables ni dependencias de pago.
- No desplegar migraciones de permisos o cambios cloud sin su revision y autorizacion.

## 2. Modelo comprensible

| Concepto | Significado | Presentacion |
| --- | --- | --- |
| Cuenta | Quien inicio sesion | Identidad y rol compactos, siempre consultables |
| Ficha | Persona a la que pertenecen los datos | Nombre principal e identidad coherente en mapa e incidentes |
| Asignacion | A quien puede cuidar o representar esta cuenta | Relacion explicita; no asumirla por coincidencia de nombre |
| Dispositivo emisor | De donde sale GPS, SOS o telemetria | Fuente identificable, separada de la persona |
| Receptor | Donde se solicito recibir avisos | PC/navegador o instalacion Android concretos |
| Puente local | Adaptacion entre ficha local y remota | Detalle avanzado, no tarea repetida del cuidador |

El rol pertenece a un espacio y los permisos efectivos a una ficha. Una cuenta
con varios espacios no debe heredar capacidades de otro espacio por conveniencia.

## 3. Recorridos objetivo

### Persona cuidada en Android

1. Iniciar sesion y verificar identidad y acceso efectivo.
2. Mostrar su ficha; si solo hay una autorizada, preseleccionarla sin iniciar envios.
3. Presentar consentimiento y permisos pendientes solo cuando sean necesarios.
4. Iniciar seguimiento mediante una accion explicita.
5. Mostrar esperando GPS, lectura obtenida, envio confirmado o problema concreto.
6. Mantener visibles detener seguimiento y solicitar ayuda, sin controles administrativos.

Cuando no haya permiso de emision, explicar que debe resolverlo un administrador.
No ofrecer crear otra ficha como remedio. No presentar red local como requisito
del GPS por internet. Mantener el cinturon como opcion independiente.

### Cuidador en PC o portal

1. Iniciar sesion y recuperar personas autorizadas y seleccion anterior valida.
2. Elegir a quien consultar; resolver el puente local solo cuando sea necesario.
3. Entrar al monitoreo, con la identidad remota visible y sin requerir un emisor PC.
4. Ofrecer avisos del navegador como opcion, sin bloquear el panel si se deniegan.
5. Atender incidentes solo con el permiso correspondiente y confirmacion de guardado.

Si solo hay una persona autorizada puede aparecer preseleccionada. Si el puente
local es ambiguo, requiere confirmacion explicita; nunca se empareja por nombre.
El cuidador con permiso de configurar geocerca conserva esa capacidad para sus
fichas. Los controles de otros ambitos no deben aparecer como pendientes propios.

### Cuidador en Android

1. Iniciar sesion y acceder a las personas asignadas.
2. Ofrecer registrar este celular para avisos y comprobar el registro remoto.
3. Explicar separadamente permiso Android, registro y dependencia del emisor FCM.
4. Ofrecer una prueba identificada, consentida y con destino claro.
5. Continuar monitoreando aunque el push no este disponible.

La emision desde una cuenta cuidadora con permiso GPS debe ser una tarea
secundaria explicita. Nunca debe confundirse con consultar la ubicacion ajena.

### Administrador

Preparar fichas, asignaciones y capacidades; comprobar el emisor compartido cuando
se requiera; revisar las relaciones antes de invitar. Mantener separadas la
administracion del espacio, la operacion del cinturon y las pruebas de su GPS.
El modo de prueba existente conserva confirmacion y marca de PRUEBA.

## 4. Etapas de trabajo

### Etapa 0. Inventario reproducible

- Identificar fuente, panel servido, Centro activo, APK instalada y migraciones vigentes.
- Levantar matriz de cuentas anonimizadas: rol por espacio, ficha, lectura,
  configuracion, emision y recepcion permitidas.
- Documentar los modos HTTP/HTTPS y las diferencias entre desarrollo y portable.
- Crear respaldo consistente de SQLite y un punto de retorno de ejecutables.
- Reproducir los fallos sin enviar alertas reales ni modificar asignaciones de terceros.

Aceptacion: cada problema tiene escenario, resultado esperado, evidencia y capa
responsable. Lo no reproducido queda como hipotesis, no como fallo confirmado.

### Etapa 1. Identidad y cierre seguro

- Mostrar la misma persona remota en encabezado, mapa, incidentes y contacto.
- No mezclar datos locales de una persona con GPS o eventos de otra.
- Cuando difieran ficha local y remota, hacer explicita la relacion antes de operar;
  separar sus fuentes y contactos en vez de sobrescribir nombres silenciosamente.
- Limpiar lecturas anteriores al cambiar cuenta, espacio o ficha; descartar respuestas tardias.
- Corregir el cierre Android para que detener seguimiento y limpiar acceso local
  no dependan de que Firebase/Supabase respondan. Resolver la baja remota fallida
  sin conservar una sesion utilizable ni afirmar que la baja fue confirmada.

Aceptacion: pruebas con nombres repetidos, cambio rapido de ficha, token vencido
y cierre sin internet. Ningun dato antiguo queda atribuido a la persona nueva.

### Etapa 2. Preparacion especifica por capacidades

- Derivar los pasos de permisos efectivos, no solo de la etiqueta de rol.
- Separar consulta, emision y recepcion en estados independientes.
- No pedir Reanudar envios a quien solo consulta una ficha.
- Presentar dependencias administrativas como ajenas al cuidador y sin botones que no pueda ejecutar.
- Tratar ausencia de asignacion, cuenta revocada y fallo de consulta como estados distintos.
- Mantener el acceso a funciones parciales validas: push pendiente no bloquea el mapa.

Aceptacion: cada cuenta ve solo acciones pertinentes; los controles ocultos no
sustituyen la autorizacion del servidor. Una cuenta limitada no obtiene permisos nuevos.

### Etapa 3. Continuidad y recuperacion

- Reconstruir el vinculo guardado por cuenta, espacio y ficha; ofrecer Continuar
  al monitoreo y una accion secundaria para cambiarlo.
- No reiniciar seleccion y consentimiento de vinculacion por una simple renovacion del token.
- Distinguir la primera configuracion de volver a entrar al uso cotidiano.
- Ofrecer recuperacion contextual ante desconexion, servidor apagado, version
  incompatible y cambio HTTP/HTTPS del Centro.
- Evaluar persistencia de sesion Android con almacenamiento seguro y cierre efectivo.
  Es una decision de seguridad separada; no guardar contrasenas ni activar GPS
  automaticamente como atajo de usabilidad.

Aceptacion: volver a Preparacion no parece perder el vinculo. Reiniciar o perder
internet lleva a una accion concreta sin duplicar fichas, dispositivos ni envios.

### Etapa 4. Asistencia inicial integrada

- Mostrar una lista breve de requisitos pendientes dentro del espacio habitual,
  sin crear otra aplicacion, ventana o configurador paralelo.
- Una accion principal por paso; ayuda ampliable para situaciones excepcionales.
- Permitir omitir funciones opcionales y retomarlas despues.
- Mostrar el destino de cada accion y conservar selecciones validas al navegar.
- No exigir QR, certificados LAN o Bluetooth para el recorrido por internet.

Aceptacion: una persona nueva puede completar su recorrido sin alternar entre
manuales, consola, varias ventanas y apartados no relacionados con su rol.

### Etapa 5. Comprobacion de resultado

| Estado | Evidencia minima |
| --- | --- |
| Acceso verificado | Sesion valida y permisos recuperados |
| Ficha seleccionada | Identificador autorizado y relacion local/remota confirmada |
| GPS recibido | Respuesta confirmada del servidor, hora y frescura de la lectura |
| Incidentes consultados | Consulta exitosa reciente, no lista vacia por error |
| Avisos del navegador habilitados | Permiso concedido y preferencia de la interfaz |
| Android registrado | Registro remoto confirmado para cuenta e instalacion actuales |
| Prueba solicitada | Solicitud aceptada; aun no equivale a entrega |
| Prueba recibida | Evidencia de recepcion o confirmacion explicita del receptor |

No implementar una barra unica de 100% que oculte estas diferencias. Una lectura
GPS imprecisa, una posicion antigua y un servicio Android activo no son pruebas
de ubicacion actual ni de salida de geocerca. Las pruebas deben marcarse y no
convertirse en emergencias reales por completar el asistente.

### Etapa 6. Refinamiento visual transversal

#### Composicion

- Mantener la estetica existente: superficies claras, teal para acciones,
  texto oscuro y bordes discretos. Sin heroes ni decoracion innecesaria.
- Formularios con ancho orientativo de 520 a 600 px, adaptado al espacio real.
- Cuenta y rol en resumen compacto; la persona y su tarea son la prioridad visual.
- Agrupar por tarea y no por tecnologia. Los detalles tecnicos van en ayuda o diagnostico.
- No anidar tarjetas ni convertir cada seccion en otra caja.

#### Tipografia y ritmo

- Mantener Geist para trabajo y las decisiones de marca existentes.
- Titulos internos de 18 a 22 px; etiquetas de 13 a 14 px; cuerpo de 14 a 16 px.
- Peso medio en etiquetas; reservar seminegrita para titulos, estados y acciones relevantes.
- Usar separaciones coherentes de 8, 12, 16 y 24 px segun agrupacion.
- No ampliar todos los margenes: equilibrar densidad interna y espacio entre tareas.

#### Controles y estados

- Alturas consistentes de 42 a 44 px en escritorio; objetivos tactiles de al menos
  48 px cuando corresponda en Android y movil, sin reducir legibilidad.
- Icono, texto y flecha alineados; menu del ancho del campo, con nombres largos legibles.
- Bordes de 6 px en controles y hasta 8 px en menus/modales, segun el sistema actual.
- Botones deshabilitados neutros; teal no debe sugerir disponibilidad inexistente.
- Usar iconos para acciones compactas con nombre accesible y tooltip.
- Texto e icono para diferenciar estados: no depender solo del color.
- Ambar para atencion/configuracion; rojo para incidentes reales prioritarios;
  confirmaciones discretas sin convertir toda la pantalla en verde.
- Toast suave para guardados; impedimentos y alertas persistentes permanecen
  junto a la tarea. No sustituir incidentes pendientes por toasts que desaparecen.
- Foco visible, navegacion por teclado, orden de lectura y dialogos con opcion segura inicial.

Aceptacion visual: revision a 1920x1080, 1366x768 y 390x844, con zoom normal,
menus abiertos, nombres largos, varios espacios y estados vacios/de error.
No aceptar texto cortado, acciones fuera de pantalla, movimientos de layout
por carga ni controles que parezcan ajenos al sistema.

### Etapa 7. Validacion y distribucion

- Unitarias: capacidades por ficha, seleccion persistida, estados y recuperacion.
- Integracion: autorizacion y revocacion, rutas locales, contratos entre versiones,
  datos tardios y cambios de cuenta/espacio sin contaminacion.
- SQL aislado si cambia backend: dos cuentas no administradoras y otro espacio
  sin acceso; comprobar idempotencia y ausencia de escalamiento de permisos.
- Visuales: web y Android; un APK compilado no equivale a validacion visual nativa.
- Fisicas: dos celulares/cuentas, Wi-Fi y datos moviles, bloqueo de pantalla,
  reinicio, GPS degradado, permisos de notificacion denegados y receptor sin conexion.
- Prueba humana: alguien que no desarrollo el sistema debe completar el recorrido
  sin ayuda verbal; registrar dudas, pasos repetidos y bloqueos, no solo clics.
- Preparar candidatas nuevas sin reemplazar versiones publicadas; verificar firma,
  integridad y paquete descargado desde una extraccion limpia.
- Actualizar manuales y changelog con el flujo que realmente quedo disponible.

Aceptacion: no declarar completado el flujo movil mientras falte su prueba fisica.
Un canal opcional puede quedar pendiente si se identifica claramente y no bloquea
funciones que ya son utilizables. Los defectos de identidad, privacidad o acceso
son motivo para detener la publicacion de esa etapa.

## 5. Riesgos previstos y prevencion

| Riesgo | Prevencion |
| --- | --- |
| Asistente largo y obligatorio cada vez | Solo primera configuracion o requisitos realmente pendientes |
| Automatizar una asociacion equivocada | Usar identificadores autorizados; confirmacion en ambiguedades |
| Ocultar funciones legitimas de un cuidador | Evaluar capacidades por ficha, no aplicar prohibiciones globales |
| Sesion recordada en una PC compartida | Definir politica explicita; no persistir secretos por comodidad |
| Nueva estetica que vuelva a fragmentar el sistema | Reutilizar componentes y revisar Personas, mapa, acceso y Android |
| Configuraciones simultaneas de administradores | Cambios acotados, deteccion de conflictos y conservacion de otros cambios |
| Prueba confundida con asistencia real | Marca persistente de prueba y separacion del motor de incidentes reales |
| FCM pendiente que parezca sistema caido | Mostrar monitoreo disponible y dependencia push por separado |

## 6. Que no se hara

No reescribir todo el proyecto, crear otro panel administrativo, convertir la
preparacion en una sucesion de modales, duplicar fichas para sortear permisos,
pedir al cuidador claves de Firebase/Supabase, ni ocultar errores bajo un mensaje
generico de exito. Tampoco se eliminara el modo local ni se forzara infraestructura
de pago para simplificar una demostracion.

## 7. Critica anticipada del resultado

Un asistente puede verse ordenado y seguir siendo malo si obliga a repetir pasos.
Una cabecera compacta puede ocultar demasiado la identidad. Una preseleccion puede
parecer consentimiento. Una marca de listo puede ocultar GPS antiguo o push sin
probar. Estos son fallos de aceptacion, aunque el diseno resulte mas atractivo.

El resultado esperado no es que todo parezca habilitado: es que cada persona
entienda que puede hacer, que falta, quien puede resolverlo y como continuar.

## 8. Puertas de avance

Todas las etapas estan pendientes en este plan. Cada una debe cerrar con:

1. Cambios y limites documentados.
2. Pruebas automatizadas proporcionales al riesgo.
3. Evidencia visual de los estados afectados.
4. Pendientes fisicos/humanos explicitamente separados.
5. Revision de regresiones y procedimiento de retorno que no revierta datos ajenos.

No usar una restauracion global de Supabase como retorno de un cambio de interfaz.
No reiniciar una instancia de uso sin informar la pausa que ocasionara. Los cambios
de esquema, credenciales persistentes o permisos se presentan antes de activarlos.
