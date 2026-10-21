# Crear el proyecto de pruebas de SFA

Proyecto ya creado y esquema inicial aplicado: consultar el
[registro de preparacion](SUPABASE_ESTADO.md). Los pasos siguientes se conservan
como guia reproducible para un proyecto nuevo, no para repetir la migracion
en el actual.

## Objetivo de este paso

Crear el contenedor online del prototipo. Todavia no subir datos reales,
ejecutar la migracion SQL ni modificar la aplicacion. La preparacion local
esta en [el plan de ampliacion](PLAN_AMPLIACION.md).

## 1. Cuenta y proyecto

1. Abrir [Supabase Dashboard](https://supabase.com/dashboard) y crear o ingresar
   a tu cuenta. Protegerla con autenticacion de dos factores cuando sea posible.
2. Crear o seleccionar una organizacion personal para las pruebas. Elegir el
   plan gratuito si esta disponible; revisar las condiciones vigentes antes
   de confirmar. No hace falta contratar un plan para esta preparacion.
3. Elegir **New project** y nombrarlo `SFA Asistencia - Pruebas`.
4. Generar una contrasena fuerte para PostgreSQL y guardarla en un gestor de
   contrasenas. No es la contrasena de los cuidadores ni debe ir en la APK.
5. Elegir una region cercana a Paraguay entre las disponibles. Anotar la
   region elegida y esperar a que el proyecto termine de prepararse.

Los nombres de menus pueden cambiar en el Dashboard. No aceptar una mejora
de pago para continuar sin revisar primero el motivo.

## 2. Acceso cerrado

En **Authentication**, localizar la configuracion de registro/proveedores:

- Desactivar **Allow new users to sign up** para evitar registro publico libre.
- Mantener desactivado el inicio de sesion anonimo.
- Conservar la verificacion de correo para las cuentas que se incorporen.
- No crear todavia cuentas reales de familiares ni residentes.

La creacion controlada de cuentas de prueba y el administrador inicial se
realizaran en la siguiente etapa. Desactivar registro no crea un administrador
automaticamente ni reemplaza las politicas RLS.

## 3. Identificadores y claves

En **Connect** o la configuracion de API, localizar:

| Dato | Manejo |
| --- | --- |
| Project URL, normalmente `https://....supabase.co` | Se puede compartir para configurar la integracion |
| Project reference | Identificador del proyecto, no una contrasena |
| Publishable key, `sb_publishable_...` | Para clientes, siempre combinada con RLS y sesiones |
| Secret key, `sb_secret_...` | Solo backend online controlado; no compartir por chat |
| Clave heredada service_role | Tambien privilegiada; no usar en apps o puentes distribuidos |
| Contrasena de PostgreSQL | Privada; no compartir ni publicar |

No publiques capturas con secretos. No pegues el panel completo de claves en
el chat. Si una clave privilegiada se filtra, rotarla desde Supabase.

En esta etapa no hace falta que copies ninguna clave a archivos del proyecto:
el codigo actual aun no consume configuracion Supabase. Prepararemos esa
conexion de forma explicita en la etapa 2.

## 4. Punto de control

Cuando el proyecto este disponible, comunicar solamente:

- Que esta creado y su nombre.
- La region.
- La Project URL, si deseas continuar la configuracion.
- Si pudiste desactivar el registro publico y el acceso anonimo.

No ejecutar aun `supabase/migrations/202610200001_base_sfa.sql` sobre una base
que contenga datos importantes. Primero revisaremos el proyecto de pruebas,
aplicaremos la migracion de manera controlada y verificaremos dos grupos
ficticios sin visibilidad cruzada. Despues prepararemos la migracion real.

## Limites

Crear Supabase no publica la web ni crea la APK, el backend de reglas o FCM.
Los correos de autenticacion y sus restricciones tampoco equivalen al canal
de alertas del sistema. Los limites, suspension por inactividad y condiciones
del plan gratuito deben revisarse en el Dashboard; no es una garantia de
servicio para emergencias.

Documentacion oficial consultada:
- [Configuracion de Auth](https://supabase.com/docs/guides/auth/general-configuration)
- [Claves API](https://supabase.com/docs/guides/getting-started/api-keys)
- [Datos de usuarios](https://supabase.com/docs/guides/auth/managing-user-data)
