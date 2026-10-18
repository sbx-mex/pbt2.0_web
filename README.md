# PBT Web 2.0 · V21

Versión resumida para Café y DT. Base: `385d7f17fd84b299d143ffe628127f5750672299`.

## Subir esta actualización

Descomprime el ZIP y reemplaza su contenido en la raíz, conservando las carpetas. Incluye **`.github/workflows/motores-semanales.yml`**, con el punto inicial. Una carpeta llamada `github` no activa GitHub Actions. Se conserva la publicación actual de Pages desde la rama; la validación adicional se ejecuta al subir el workflow a su ruta correcta.

El ZIP sólo contiene los cambios necesarios. Los dieciséis CSV y los archivos originales del motor ya existentes se conservan. Esta entrega incluye el índice actualizado de las semanas 01–16. Espera el resultado de Pages y de **Validar PBT semanal** tras subir los archivos.

## Operación

- **Café / DT:** cada entrada muestra únicamente el selector de tienda. No se calculan ni muestran promedios de todas las tiendas. Al seleccionar una tienda aparecen su filtro, porcentajes y plan. Cambiar de pestaña o limpiar exige seleccionar de nuevo.
- **Tienda:** busca por CeCo o nombre. El cruce usa los 993 registros de Directorio_PBT.xlsx; las 950 tiendas presentes en los dieciséis motores tienen correspondencia. El tipo Café/DT se resuelve con la evidencia del canal DT en unidades actuales o AA, sin usar filas de cero como evidencia.
- **Filtro:** uno o varios meses, un grupo de días y un turno. Manual conserva tu elección; Automático usa el reloj del dispositivo. Cambiar días o turno activa Manual.
- **Porcentajes enteros:** se calculan sobre las unidades seleccionadas. El reparto por mayor residuo cierra canal y producto a 100%, sin alterar unidades ni asignar toda la diferencia a la primera categoría. La distribución entera es también la entrada al play original.
- **Acerca de:** concentra instrucciones, motores, carpeta, archivos, estado, totales, unidades y AA, equipo e información del proyecto. Las rutinas y el plano usan el motor original.
- **PDF:** imprime únicamente filtro, porcentajes, plano y rutinas del contexto seleccionado. Carta, márgenes de 12.7 mm, coordenadas originales y encabezados repetidos si hace falta continuar las rutinas. Los nombres sólo aparecen al estar asignados. No imprime controles, “Seleccionar”, instrucciones, firma de diseño ni origen de datos.

Nombre automático: `PBT_38333_lun-jue_Manana_4Partners.pdf`. Para Vie–Dom usa `vie-dom`; los turnos son `Manana`, `Intermedio` o `Tarde`.

La fuente agrupa **Lun–Jue** y **Vie–Dom**. El mes conserva el calendario PBT 4-4-5 con año. AA corresponde al mismo segmento informado en el CSV y nunca se suma al denominador actual. Una selección sin unidades positivas o con categorías negativas no genera un plan.

La base original sobre venta sigue disponible en Acerca de. Algunos nombres históricos difieren del directorio: no se inventan cruces CeCo. La exportación con CeCo requiere una correspondencia; el flujo de los CSV semanales está cruzado por código.

## Revisión con Python

```bash
python scripts/build_weekly_motor.py
python scripts/build_store_directory.py --check
python -m unittest discover -s tests -v
node --test tests/*.test.cjs
python scripts/audit_percentages.py
python scripts/audit_weekly_project.py
```

Para actualizar nombres desde otro directorio:

```bash
python scripts/build_store_directory.py --source "Directorio_PBT.xlsx"
```

Sube `js/store-directory.js` junto con los cambios del directorio. El generador sólo lee el Excel; no modifica sus celdas. Utiliza Python estándar. La validación compara CSV crudos contra el motor web y conserva sin cambios `js/excel_data.js`, plays, rutinas, coordenadas y calendario originales.

Para nuevas semanas, agrega los CSV y regenera/sube también `data/motores/indice.json` cuando Pages publique desde la rama. La opción de publicar automáticamente el índice generado por Actions requiere configurar Pages con fuente GitHub Actions y la variable `PBT_DEPLOY_PAGES=true`; permanece desactivada de forma predeterminada.

Resultados de esta entrega: `reports/audit-v21.json`. El verde local acredita la revisión del paquete; el nuevo despliegue se confirma en GitHub después de cargarlo.
