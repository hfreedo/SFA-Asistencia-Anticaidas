# Estado de la documentación

[Índice de manuales](README.md)

Esta página explica **qué se revisó para preparar las guías y qué evidencia no debe deducirse de ellas**. Referencia: 29 de octubre de 2026, Windows rc13.1 y Android 0.7.1.

## Fuentes y orden de lectura

Las nuevas guías se contrastaron con el sketch, servidor Python, componentes React, clases Kotlin, migraciones SQL y manifiestos de dependencias. Las páginas de etapas anteriores se mantienen como historia técnica; no se trasladaron sus restricciones antiguas al recorrido habitual sin comprobarlas.

La organización sigue esta secuencia: **uso en PC → uso remoto → tecnologías → código → exposición → comprobación**. El índice permite entrar directamente en una tarea y cada guía enlaza su continuación.

Las decisiones centrales se resaltan con negrita selectiva: dependencia del emisor PC, separación de identidades, calidad GPS, contratos e integridad de la atención. El objetivo es que la explicación pueda leerse sin depender del color.

## Capturas

Las imágenes de `manuales/capturas/` se obtuvieron ejecutando los recursos construidos del panel y portal con `scripts/verificar_preparacion.cjs`. Los servicios se sustituyeron por respuestas ficticias; las cuentas usan el dominio reservado `example.invalid`. No se introdujeron credenciales reales ni se enviaron invitaciones o avisos externos.

**Son capturas de la interfaz ejecutada con fixtures, no fotografías de pruebas físicas ni consultas a un residente real.** Tampoco demuestran que todo ZIP antiguo tenga la misma apariencia. Representan los recursos de trabajo capturados; los hashes identifican esas imágenes y los bundles usados.

La [procedencia de las capturas](manuales/capturas/PROCEDENCIA.json) conserva archivos, comandos y sumas SHA-256. [capturar_manuales.cjs](../scripts/capturar_manuales.cjs) reproduce los cuatro recorridos, coloca el scroll arriba antes de capturar y actualiza ese manifiesto. Las capturas del panel sobre pantalla móvil muestran una web estrecha, **no una app Android nativa**.

No se incorporó una captura Android de procedencia no comprobada. El manual remoto describe el recorrido contrastado con el código y deja explícita esa limitación.

## Comprobaciones reproducibles

### Estructura y fidelidad

```powershell
py -3.13 scripts/validar_documentacion.py
```

Comprueba ocho guías, enlaces locales y anclas, cercos Markdown, capturas con sus hashes y fragmentos contra los archivos fuente. Se ejecuta sin servicios externos. Una comprobación de estructura no garantiza por sí sola la calidad de la explicación.

### Pantallas de la aplicación

Con Node.js, Playwright y su navegador preparados, desde la raíz:

```powershell
node scripts/verificar_preparacion.cjs --linked --home
node scripts/verificar_preparacion.cjs --linked
node scripts/verificar_preparacion.cjs --linked --people
node scripts/verificar_preparacion.cjs --linked --portal
```

Cada recorrido comprueba tres anchos de pantalla, errores JavaScript y desbordamiento horizontal. Las respuestas remotas son ficticias; no crean una invitación ni escriben sobre datos alojados. Para usar un runtime externo se admiten `SFA_PLAYWRIGHT_MODULE` y `SFA_QA_BROWSER`.

### Lectura de Markdown y Mermaid

La revisión de esta entrega incluye renderizado local de las guías con Markdown y Mermaid, inspección de diagramas y capturas y medición de desbordamientos en escritorio y móvil. El renderizado local usa un tema sencillo; GitHub puede variar tamaños y saltos de línea. La comprobación publicada con esta colección revisa enlaces y contratos; no instala dependencias gráficas en la aplicación.

Las instrucciones y dependencias del renderizador están en [herramientas/documentacion](../herramientas/documentacion/README.md). La CI `Documentacion` revisa estructura y renderizado en cada cambio relevante. Los resultados de la ejecución local se separan del estado de la CI alojada: una configuración de workflow no equivale a un run aprobado.

Resultados locales de esta revisión: **24 combinaciones de guía y ancho**, once diagramas Mermaid renderizados en los tres anchos y cinco capturas verificadas por hash. Los cuatro recorridos de interfaz también pasaron a 1920, 1366 y 390 píxeles, con fixtures y sin escrituras remotas. Los fragmentos seleccionados se compararon con siete contratos de las fuentes. Son comprobaciones de documentación y software de interfaz, no del hardware.

## Lo que estas comprobaciones no prueban

- Detección física del cinturón o eficacia médica.
- Precisión real del GPS y continuidad con pantalla bloqueada.
- Recepción, lectura y atención de un push en dispositivos reales.
- Instalación del portable en otra PC o identidad exacta de un despliegue alojado.

Esas evidencias se registran en las guías de pruebas y notas de cada entrega. **No se actualizan los resultados históricos por el hecho de publicar estos manuales.**

## Mantener las guías

Cuando cambie una pantalla, vuelve a capturar con datos ficticios y actualiza su procedencia. Si cambia una RPC o el protocolo, revisa [Código y nexos](GUIA_CODIGO_Y_NEXOS.md), los extractos y el verificador. Antes de publicar, comprueba el mismo conjunto de archivos en el checkout público y revisa que los enlaces del README lleven a las guías vigentes.
