# PBT Web 2.0 · V20

Actualización de `sbx-mex/pbt2.0_web`, basada en `8c08b5a7db60ec83adcfd10b76affbd1d26fab96`. La vista de canales y mix presenta porcentajes del contexto seleccionado; las unidades actuales y AA se consultan en un detalle desplegable.

## Instalar esta entrega

1. Descomprime el ZIP y sube **su contenido a la raíz del repositorio**, conservando las carpetas. Incluye `.github/workflows/`.
2. Reemplaza los archivos incluidos. Los CSV y los archivos originales `js/data.js` y `js/excel_data.js` ya están en el proyecto y se conservan.
3. Espera el resultado de **Validar PBT semanal** y la publicación habitual de Pages. Esta entrega incluye el índice actualizado de las cinco semanas disponibles; funciona con la publicación actual desde la rama.
4. Abre la página y recarga para recibir V20. Si tenías una carpeta local seleccionada, pulsa **Releer carpeta** una vez para recuperar AA por segmento con el nuevo formato.

El ZIP contiene únicamente cambios, pruebas, índice optimizado y documentación necesaria. No es una copia completa del repositorio. La comprobación local en verde acredita estos archivos; el resultado del nuevo despliegue se confirma en GitHub después de subirlos.

## Diez mejoras verificables

1. **Denominador correcto:** cada selección suma sus unidades actuales antes de calcular canales y mix. Seleccionar varios meses pondera por unidades; no promedia porcentajes semanales.
2. **100.0% con una decimal:** reparte las décimas restantes entre las categorías con mayor residuo. No carga toda la diferencia a Espresso o Lobby. La diferencia frente al cociente exacto es menor de 0.1 puntos porcentuales.
3. **Drive Thru con evidencia:** una tienda pertenece a DT si algún CSV contiene unidades DT actuales o AA distintas de cero. Las filas de ceros no bastan. El buscador encuentra todas las tiendas y abre automáticamente Café o Drive Thru, conservando el contexto.
4. **Selecciones claras:** uno o varios meses; un solo grupo de días y un solo turno. Las listas de días y turno siempre están disponibles. Cambiarlas activa Manual; Automático vuelve al reloj del dispositivo.
5. **AA alineado:** el detalle opcional muestra unidades por canal y producto, más el comparativo por semana. Aplica los mismos filtros a actual y AA. AA no se suma al denominador actual. Cuando falta, muestra “No disponible”.
6. **Sin porcentajes inventados:** una selección vacía, con total no positivo o categorías con saldo negativo no genera porcentajes ni plan. Conserva los ajustes originales para revisarlos.
7. **Cinco motores incorporados:** el índice anterior incluía tres archivos aunque la carpeta ya tenía cinco. Esta entrega concilia los cinco CSV, sin reescribirlos.
8. **Recuperación estable:** migra las lecturas V19 sin fabricar AA por segmento; permite releer la carpeta. El cambio de fuente ocurre después de validar filas, semanas, duplicados, unidades actuales y AA por archivo.
9. **PDF carta directo:** conserva la jerarquía del original: periodo, comentarios, información del turno, porcentajes, layout y tabla Partner / Estación / Fijo / Rutinas. Tamaño nativo 612 × 792 pt, márgenes 12.7 mm y encabezados repetidos si las rutinas continúan. No depende de configurar el diálogo de impresión. Conserva nombres, fotos y coordenadas del plan activo.
10. **Revisión reproducible:** Python concilia el CSV crudo con el cálculo web; las pruebas incluyen la lógica del Excel consolidado, AA, DT, meses múltiples, filtros vacíos y paginación. La caché V20 evita mezclar versiones de interfaz. La navegación mantiene una sola barra de secciones.

## Reglas de operación

- **Meses:** calendario 4-4-5 del PBT original, derivado de `Semana` en formato `AAAASS`. Enero 01–04, febrero 05–08, marzo 09–13; se repite la distribución 4-4-5 en cada trimestre. Semana 53 pertenece a diciembre. El año se incluye en el nombre del mes.
- **Días:** Lun–Jue o **Vie–Dom**. La fuente agrupa viernes a domingo: no permite calcular Vie–Sáb separado.
- **Turno:** Mañana 06–12 h, Intermedio 12–17 h, Tarde 17–06 h, según la regla original. Manual se conserva al recargar y no cambia con el reloj.
- **Canales:** Lobby, Pick up & Delivery y DT cuando corresponde. Una tienda DT conserva ese layout aunque el filtro actual tenga 0.0% de DT.
- **Producto:** Espresso, COD, CBS, Food y Otro. COD utiliza la clave interna “Café filtrado” del motor original. El plano conserva sus rótulos originales de estaciones.
- **Planeación:** los porcentajes visibles conservan una decimal. La búsqueda del play usa una distribución entera que también cierra a 100 y consulta los plays originales.
- **Base original:** sigue disponible, calcula sobre venta y se identifica como tal. No se mezclan esas cifras con unidades de los CSV.
- **Carpeta local:** el acceso es de lectura; los CSV se procesan en el dispositivo. Si el navegador no conserva el acceso, vuelve a elegir la carpeta. Una lectura inválida o cancelada conserva la fuente anterior.

## Mantener las siguientes semanas

Conserva un CSV por semana en `data/motores/`, con subcarpetas si lo necesitas. Para corregir una semana reemplaza su archivo. Una copia idéntica se omite; dos versiones distintas de la misma semana se rechazan.

Para publicar desde la rama actual, genera el índice después de agregar CSV y sube ambos:

```bash
python scripts/build_weekly_motor.py
python scripts/build_weekly_motor.py --check
python -m unittest discover -s tests -v
node --test tests/*.test.cjs
python scripts/audit_percentages.py
python scripts/audit_weekly_project.py
```

Python y Node no requieren instalar dependencias para estas comprobaciones. El exportador PDF está incluido localmente con licencia MIT.

La lectura desde **Abrir carpeta CSV → Releer carpeta** funciona sin regenerar el índice del repositorio: procesa directamente los archivos locales.

### Publicación por Actions, opcional

La validación nueva se ejecuta en cada push y solicitud de cambio. La publicación personalizada permanece desactivada para respetar Pages desde la rama, que ya funciona. Para que las futuras cargas de sólo CSV generen el índice y se publiquen automáticamente:

1. Selecciona **Settings → Pages → Source → GitHub Actions**.
2. Crea la variable de repositorio **PBT_DEPLOY_PAGES** con valor **true**, en **Settings → Secrets and variables → Actions → Variables**.
3. Ejecuta **Validar PBT semanal** o realiza un push. Sólo publica si todas las validaciones pasan; las solicitudes de cambio únicamente validan.

## Lo que se confirmó correcto

El archivo original `js/excel_data.js` conserva su SHA-256. La comparación con el Excel original pasó sin diferencias: 60,950 coordenadas, 32,368 rutinas, 459,256 claves de play, 32,804 combinaciones de mix y 3,021 valores de producción por canal. Se conservaron la transformación fila +17 / columna +1 y los anchos del plano.

El caso de `Reporte_Consolidado_Canal_Mix.xlsx`, tienda 38368, año 2025, semanas 28–32, Lun–Jue, Tarde, reproduce 3,178 unidades: canales 95.0% / 5.0%; mix 36.7%, 2.8%, 44.9%, 11.7%, 3.9%. Es una prueba de referencia; la aplicación calcula los valores de los CSV activos.

Los resultados de esta entrega se registran en `reports/audit-v20.json`.
