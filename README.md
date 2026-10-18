# PBT Web 2.0 · V26

Corrige el plan en blanco y acelera la consulta de motores sobre `34d372a8a577c4f2739d23aab177995be7952283` de `sbx-mex/pbt2.0_web`.

## Instalar

Descomprime y reemplaza **sólo los archivos del ZIP en la raíz del repositorio**, conservando sus carpetas. No subas el ZIP cerrado ni una carpeta adicional. Mantén los CSV y los demás archivos existentes.

Conserva **Settings → Pages → Source → GitHub Actions**. El workflow existente ejecuta `validar` antes de `publicar`. Python genera el catálogo compacto durante esa revisión; `js/plan-catalog.js` es un resultado de compilación y no se incluye en el ZIP ni se edita a mano. La publicación lo incorpora automáticamente si pasan los siete controles.

## Cambios de carga

- **Plan visible.** Se elimina la referencia al botón Ampliar retirado en V25: provocaba un error que detenía el renderizado.
- **Catálogo de planes más ligero.** Python transforma el original de 23.9 MB en 6.4 MB y verifica sus 459,256 búsquedas. Conserva candidatos, planes, coordenadas, rutinas y desempates originales. El navegador ya no descarga `excel_data.js`.
- **Consulta por CeCo.** El motor usa un índice por tienda para evitar recorrer todo el histórico en cada filtro. Los porcentajes, unidades y AA conservan sus resultados.
- **Respaldo antes de la red.** Recupera el motor guardado y lo valida antes de mostrarlo; después comprueba si existe una actualización.
- **Sólo descarga cuando hay cambios.** Consulta el manifiesto y reutiliza el índice verificado si coincide. Evita descargar otra vez los 15.5 MB del índice cuando no cambió.
- **Actualización protegida.** Comprueba tamaño, SHA-256, semanas y relación entre índice y CSV. Una actualización inválida no reemplaza el plan activo.
- **Menos trabajo repetido.** Reutiliza búsquedas de mezcla y elimina renderizados duplicados al elegir una tienda.

El primer acceso necesita descargar los motores. Una conexión lenta puede afectar esa primera descarga. Los accesos posteriores aprovechan el respaldo mientras esté disponible en el dispositivo. Los CSV siguen siendo la fuente de porcentajes; la base original conserva la selección de planes y su distribución.

## Equipo, móvil y PDF

Se mantienen las mejoras de V24/V25: equipo y fotos por CeCo, recuperación de filtros, selección de tiendas Café/DT según unidades, tabla adaptable, plan sin botón Ampliar y PDF sin pie de página. El PDF conserva los recuadros, margen carta y nombre dinámico. En iOS, **PDF listo** permite descargar y compartir cuando el navegador lo admite.

El guardado corresponde a **este dispositivo, navegador y dirección del proyecto**. Borrar los datos del sitio elimina el respaldo. Si el navegador no permite guardarlo, la aplicación lo indica y conserva los datos durante la sesión. La primera apertura permanece vacía hasta elegir una tienda; sólo se recuperan selecciones guardadas que sigan disponibles en los motores.

## Revisión reproducible

Python 3.12 y Node 22. No requiere instalar paquetes para validar:

```bash
python scripts/validate_update.py --site _site
```

Usa una carpeta de salida nueva. Los siete controles generan el catálogo, reconstruyen los motores desde CSV, comprueban el directorio, ejecutan las pruebas Python/Node y auditan porcentajes y fidelidad al original. Sólo después preparan `_site` para publicar. Para abrir una copia local, sirve esa carpeta mediante HTTP.

La equivalencia del catálogo se comprueba exhaustivamente. Las pruebas también cubren el control eliminado, recuperación del respaldo, actualización corrupta y reutilización del índice sin cambios. La validación visual de V26 se realizó en WebKit con emulación de iPhone y anchos de 320, 390, 980 y 1280 px; no sustituye una prueba en dispositivos físicos Android/iOS.
