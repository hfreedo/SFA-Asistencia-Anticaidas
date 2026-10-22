# Distribución y Protección del Trabajo

Evaluación técnica y documental, no una nueva licencia ni un dictamen jurídico.
No modifica la visibilidad del repositorio, permisos existentes ni publicaciones anteriores.

## Hallazgo actual

El repositorio es público. Existe `LICENCIA_DE_USO_RESTRINGIDO.md`, que autoriza
el ejecutable para educación, demostración y evaluación, y una declaración de
autoría. La licencia no desarrolla con la misma precisión las condiciones de
las fuentes, documentación, firmware y recursos visuales. GitHub no reconoce
actualmente una licencia estándar para este repositorio; eso no equivale a ausencia de derechos.

Para cerrar esa ambigüedad hace falta identificar al titular y definir alcance,
usos autorizados, redistribución, modificaciones, atribución, soporte, garantías
y tratamiento separado de componentes ajenos. No se ha añadido una licencia
nueva que pretenda retirar permisos ya concedidos.

## Opciones

| Modelo | Portfolio | Protección práctica | Compromiso |
| --- | --- | --- | --- |
| Fuentes públicas con licencia libre | Código inspeccionable y reutilizable | Exige los términos de la licencia, no impide competencia lícita | MIT/Apache permiten reutilización comercial; GPL también permite uso comercial, con obligaciones propias |
| Fuentes públicas bajo condiciones restringidas | Implementación visible | Restricciones jurídicas, pero copia técnicamente sencilla | Es código disponible, no debe anunciarse como open source si restringe esos usos |
| Fuentes privadas y escaparate público | Arquitectura, capturas, demostración y binarios visibles | Reduce entrega directa del código propio | Dar acceso educativo o de auditoría de forma controlada; revisar licencias de dependencias |

**Recomendación según el objetivo expresado:** fuentes completas privadas y un
repositorio público de presentación con ejecutables, arquitectura, videos,
capturas, manuales de usuario y condiciones claras. Para estudiantes, acceso
por autorización a la parte educativa que se decida compartir. No es necesario
publicar toda la implementación propia para explicar las decisiones de ingeniería.

No basta borrar carpetas del último commit: el código puede seguir en el historial.
Privatizar un repositorio tampoco recupera forks ni copias existentes. Cualquier
reorganización pública debe preservar evidencia e historial privado y revisar
el efecto sobre Pages, enlaces de descargas y permisos antes de ejecutarse.

## Licencia, no solo un aviso de autoría

Antes de aprobar términos nuevos, conviene revisar con un profesional de
propiedad intelectual en Paraguay:

1. Titularidad, colaboraciones y contratos aplicables al desarrollo.
2. Autorizaciones educativas y límites de redistribución que se quieran conceder.
3. Qué componentes son propios y cuáles se incorporan bajo otra licencia.
4. Cómo se documentan permisos adicionales y evidencia de versiones y autoría.

La Ley paraguaya 1328 protege el software fuente y objeto (art. 67); también
contiene reglas sobre productor y titularidad (arts. 68 y 69). El registro es
declarativo, no constitutivo, y puede servir como principio de prueba (arts. 152
y 153). Eso no permite presumir aquí la titularidad de cada contribución ni
garantiza un resultado ante una disputa.

Una licencia no impide por sí sola toda copia, ingeniería inversa o desarrollo
competidor. Una APK o EXE puede analizarse; no contiene una protección absoluta
del código. La firma de aplicaciones acredita continuidad de la clave, no otorga
derechos de autor ni bloquea la competencia.

## Dependencias y recursos que deben revisarse

- Python, bibliotecas empaquetadas, Tcl/Tk y condiciones de PyInstaller.
- Paquetes web y fuentes tipográficas, mapas y atribuciones de sus proveedores.
- Bibliotecas Android, SDK y firmware/core Arduino que se distribuyan.
- Driver CH340/CH341: procedencia, versión y permiso de redistribución.
- Logo e imágenes: conservar comprobantes de licencia o sustituirlos por diseños
  originales/autorizados. Retocar una imagen de stock o quitar una marca no
  concede permiso sobre el original.

Los avisos actualmente copiados en los paquetes no constituyen todavía un
inventario completo. No se debe extender una prohibición de código propio a
componentes ajenos, ni omitir obligaciones de atribución o de entrega de fuentes
que puedan corresponderles. Compartir solo binarios necesita esa misma revisión.

## Decisión pendiente del titular

No se cambiará visibilidad, borrará historial, retirarán fuentes ni publicarán
términos nuevos sin confirmar el modelo elegido. Antes de migrar, preparar
respaldo privado, inventario de derechos y plan de continuidad para Pages y Releases.

## Fuentes

- [GitHub: licencias y efecto de publicar fuentes](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository).
- [GitHub: términos del servicio](https://docs.github.com/en/site-policy/github-terms/github-terms-of-service).
- [Paraguay: Ley 1328 de Derecho de Autor y Derechos Conexos](https://www.bacn.gov.py/leyes-paraguayas/908/ley-n-1328--derecho-de-autor-y-derechos-conexos).
- [Android: firma de aplicaciones](https://developer.android.com/studio/publish/app-signing).
