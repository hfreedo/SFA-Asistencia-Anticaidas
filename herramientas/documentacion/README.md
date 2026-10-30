# Comprobar la documentación

Estas herramientas revisan las guías, no cambian el programa ni se conectan a una cuenta de Supabase o Firebase.

## Comprobación rápida

Desde la raíz:

```powershell
py -3.13 scripts/validar_documentacion.py
```

No necesita paquetes externos. Revisa la colección actual, enlaces locales, anclas, capturas y extractos de código.

## Renderizado de Markdown y Mermaid

Con Node.js 22 o posterior y npm, desde la raíz:

```powershell
cd herramientas/documentacion
npm ci
npx playwright install chromium
npm run revisar
```

La primera instalación descarga dependencias. Luego la revisión usa un servidor de lectura en `127.0.0.1`, sustituyendo la presentación de GitHub por un estilo sencillo. El navegador bloquea solicitudes externas.

El resultado queda en `build/documentacion-qa/`: capturas a 1366, 768 y 390 píxeles, capturas de las secciones en escritorio y `resultados.json`. Debe haber **cero errores de Mermaid, imágenes rotas y desbordamientos de página**. Las tablas y los bloques de código se revisan visualmente, además de la medición automática.

Si ya tienes un navegador y Playwright en otro runtime, puedes indicar `SFA_QA_BROWSER` y `SFA_PLAYWRIGHT_MODULE`. No contienen credenciales. En Linux CI se instala Chromium con sus dependencias de sistema.

## Renovar las capturas de la aplicación

Construye antes panel y portal conforme a [Desarrollo](../../docs/DESARROLLO.md). Vuelve a la raíz y ejecuta:

```powershell
$env:SFA_PLAYWRIGHT_MODULE = (Resolve-Path herramientas/documentacion/node_modules/playwright).Path
node scripts/capturar_manuales.cjs
py -3.13 scripts/validar_documentacion.py
```

El generador ejecuta los recorridos existentes con fixtures, vuelve al inicio de la página antes de capturar y guarda cinco imágenes y su procedencia. **No usa el servidor de datos personales ni inicia sesión en una cuenta real.** No reemplaces estas imágenes por pantallas personales para superar una comprobación.

La CI `Documentacion` ejecuta las revisiones al cambiar las guías o los contratos relevantes. Es una ayuda para detectar regresiones; una revisión humana sigue siendo necesaria para saber si los pasos se entienden.
