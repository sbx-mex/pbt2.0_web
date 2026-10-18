# PBT Web 2.0 · V24

Actualización sobre `b6c80054bd5df42542f8bfd68431b353638ff017` de `sbx-mex/pbt2.0_web`.

## Instalar

Descomprime y reemplaza **sólo los archivos del ZIP en la raíz del repositorio**, conservando sus carpetas. No subas el ZIP cerrado ni una carpeta adicional. Mantén los CSV y los demás archivos existentes.

El workflow ya configurado ejecuta `validar` y después `publicar`. Conserva **Settings → Pages → Source → GitHub Actions**. No se modifica el workflow ni la base original de plays, coordenadas o rutinas.

## Diez mejoras

1. **CeCo recordado.** Al recargar, se recupera la última sección y la tienda elegida en Café y en DT.
2. **Filtros guardados.** Conserva meses, modo manual/automático, días, turno, cantidad de partners y Partner Tablet. En automático, días y turno siguen la hora actual.
3. **Equipo por tienda.** Los nombres y asignaciones se guardan por CeCo, sin mezclarse al cambiar de tienda.
4. **Fotos locales.** Se comprimen a 160 × 160 y se respaldan en IndexedDB. localStorage conserva una copia inmediata cuando hay espacio. No se suben a GitHub ni a un servidor.
5. **Recuperación anterior.** Selecciona la tienda correcta, abre Equipo y pulsa **Recuperar equipo anterior**. Vincula el equipo previo de esa sección al CeCo elegido una sola vez; conserva las claves anteriores como respaldo. Sólo se ofrece si la tienda aún no tiene nombres.
6. **Edición estable.** Cambiar el nombre conserva su foto y actualiza sus asignaciones. Adjuntar una foto actualiza su fila, sin reconstruir la lista ni perder la posición.
7. **Tiendas correspondientes.** Café sólo lista CeCo Café con unidades actuales positivas. DT sólo lista CeCo DT con unidades actuales positivas en Drive Thru; AA por sí solo no habilita la tienda.
8. **Plano móvil.** Altura explícita sin depender de `aspect-ratio`, campos legibles y botón **Ampliar / Ajustar** con desplazamiento dentro del plano. El botón **Ver plan** cierra Equipo sin borrar la selección.
9. **PDF sin pie.** Se mantienen los recuadros, margen carta, nombre dinámico y contenidos originales. Se elimina el pie visible, incluidos créditos y numeración inferior. Los créditos de Acerca de permanecen.
10. **Exportación en iOS.** Al terminar, muestra **PDF listo** con descarga y, cuando el navegador lo permite, **Guardar / compartir**. El segundo toque conserva el gesto que iOS requiere para compartir archivos. Mantiene el nombre dinámico y el plan abierto.

## Alcance del guardado

Se guarda en **este dispositivo, navegador y dirección del proyecto**. Otro navegador o la navegación privada usa otro espacio. Borrar los datos del sitio elimina el respaldo. La app solicita almacenamiento persistente cuando está disponible; el navegador decide si lo concede. Si no puede guardar, lo indica y conserva los datos en la sesión abierta. Política de Safari: https://webkit.org/blog/14403/updates-to-storage-policy/.

La primera apertura sigue vacía hasta elegir una tienda. Sólo las selecciones guardadas por el usuario se recuperan. La disponibilidad se vuelve a validar contra el motor al iniciar; un CeCo ausente no genera un plan. Los ajustes locales no cambian los CSV ni los porcentajes.

## Revisión reproducible

Python 3.12 y Node 22. No requiere instalar paquetes para validar:

```bash
python scripts/validate_update.py --site _site
```

Usa una carpeta de salida nueva. Los seis controles deben aprobar antes de preparar la publicación. Pruebas de almacenamiento, separación Café/DT, UI, PDF, caché y auditoría independiente de porcentajes están incluidas.

Los resultados de esta entrega corresponden a la revisión local; el estado remoto se confirma después de subir el ZIP y completar Actions.
