# HTTPS Local: PC y Android

## Qué Significaba el Mensaje

`Requirement already satisfied` no es un error: las dependencias ya están
instaladas en el entorno local. El inicio se detenía porque faltaban los archivos
de certificado y clave del servidor. El BAT ahora ejecuta su preparación asistida.

## Preparación Asistida

`herramientas/compatibilidad/iniciar_geolocalizacion.bat` prepara Python, comprueba/genera los certificados y
después inicia HTTPS. Usa OpenSSL del PATH o de una instalación habitual de Git
para Windows. Si no está disponible, muestra cómo continuar; no descarga binarios
ni modifica la confianza del sistema silenciosamente.

También se puede preparar sin iniciar el servidor:

```powershell
.\.venv313\Scripts\python.exe -m servidor_pc.preparar_https
```

Se generan dentro de `certs/`:

| Archivo | Uso | ¿Transferir al teléfono? |
| --- | --- | --- |
| `sfa.pem` | Certificado del servidor | No hace falta |
| `sfa-key.pem` | Clave privada del servidor | Nunca |
| `ca/rootCA.pem` | Certificado público de la CA local | El asistente exporta una versión CER |
| `ca/rootCA-key.pem` | Clave privada de la CA | Nunca |
| `SFA_Asistencia_CA.cer` | Certificado público para importar | Solo este archivo |

La CA sirve para esta demostración, no es una autoridad pública. Confiar en ella
permite aceptar los certificados que firme: proteger su clave privada y retirar
la confianza cuando termine la prueba. `certs/` permanece excluida de Git.
No compartir la carpeta completa ni distribuir sus claves con el release.

## 1. Confiar la CA en la PC

Ejecutar `herramientas/compatibilidad/confiar_https_pc.bat`, revisar la advertencia y, solo si se autoriza,
escribir `CONFIAR SFA`. El asistente agrega el certificado a la cuenta actual de
Windows con `certutil -user`; no instala confianza en el teléfono. Puede ser
necesario cerrar y abrir el navegador.

Pulsar Enter sin escribir la frase cancela sin cambiar el almacén de certificados.
No es necesario ni correcto desactivar las comprobaciones HTTPS del navegador.

## 2. Confiar la CA en Android

1. Transferir **solo** `certs/SFA_Asistencia_CA.cer` al teléfono de prueba por un
   medio controlado, como USB. No transferir claves privadas.
2. En Ajustes de Android buscar `certificados`, `credenciales` o `instalar certificado`.
3. Elegir la instalación de **certificado de CA**, no certificado de Wi-Fi ni
   certificado de cliente/VPN. El nombre exacto de los menús varía por fabricante.
4. Seleccionar el CER transferido, revisar el nombre `SFA Asistencia CA de pruebas`
   y aceptar únicamente si corresponde a la prueba autorizada. Android puede
   solicitar el PIN o mostrar una advertencia sobre certificados instalados por el usuario.
5. Reiniciar el navegador si es necesario. La instalación no prueba por sí sola
   que todos los navegadores acepten esa CA: comprobar la conexión real.

El asistente imprime la huella SHA-256 del certificado público para contrastarla
con el archivo transferido. No instalar una CA enviada por un tercero desconocido.

Referencia del fabricante: [Agregar y quitar certificados en Android/Pixel](https://support.google.com/pixelphone/answer/2844832?hl=es).
No se presume que todos los Android tengan los mismos menús.

## 3. Iniciar y Abrir el Panel

Cerrar únicamente la instancia propia de SFA que ocupe 8780. Después ejecutar
`herramientas/compatibilidad/iniciar_geolocalizacion.bat` y abrir `https://localhost:8780` en la PC.
En Ubicación, guardar una zona real y crear el QR privado del residente.
Con el teléfono en la misma red, escanearlo y conceder ubicación.
No se necesitan direcciones largas escritas en el celular.

Si aparece una advertencia de certificado, no saltarla: revisar la CA instalada,
la fecha de los equipos y que el certificado cubra la IP del QR. Volver a ejecutar
la preparación al cambiar de red. Con la misma CA válida solo se renueva el
certificado del servidor, sin reinstalar la CA en los dispositivos.

## Conservación y Caducidad

El certificado del servidor dura 90 días y se renueva si le quedan menos de siete
días o cambia la IP. La CA local dura un año; el asistente no cambia su identidad
automáticamente si falta su clave o se aproxima su caducidad. En ese caso hay que
planificar una nueva CA y su aceptación explícita en los equipos.
Los certificados personalizados de `.env` no se sobrescriben si fallan.

La preparación no demuestra seguimiento con pantalla apagada ni entrega de
alertas. Esas pruebas siguen siendo necesarias en el teléfono real.

## Retirar la Confianza Después de la Prueba

En Android, localizar esta CA en las credenciales instaladas por el usuario y
retirar únicamente `SFA Asistencia CA de pruebas`. En Windows, usar el administrador
de certificados del usuario actual y retirar esa CA de las raíces de confianza.
No borrar certificados del sistema ni de terceros. Si se eliminan las claves
locales, conservar primero lo necesario para identificar y retirar la CA exacta.
