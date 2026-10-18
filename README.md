# pbt2.0_web

## V19 · Motores semanales, contexto manual y PDF carta

Reemplaza los archivos de este ZIP en la raíz del repositorio, conservando sus carpetas y el resto del proyecto. Base de esta entrega: `ca81806dd2b9bc40fdc7d4c3d862dbd29d779311`.

### Operación

- **Motores semanales:** carpeta visible `data/motores/`. Contiene los tres CSV iniciales originales; permite agregar semanas y subcarpetas por año.
- **Carpeta local:** `Abrir carpeta CSV` y `Releer carpeta` identifican la carpeta y procesan archivos en segundo plano. En navegadores sin acceso persistente, usa `Elegir CSV` o selecciona la carpeta de nuevo. El acceso es de lectura; los CSV locales no se envían al servidor.
- **Mes:** único filtro visible de periodo. El mes sigue el calendario 4-4-5 del PBT original, según la semana (`AAAASS`) de cada registro: por ejemplo, 01–04 es enero, 05–08 febrero y 48–53 diciembre. La fecha del encabezado del reporte no sustituye esa columna. No hay filtros visibles de trimestre o semana.
- **Cálculo Automático / Manual:** automático conserva la regla original del reloj del dispositivo. Manual permite elegir DayPart y Weekday/Weekend y mantiene el contexto al cambiar de minuto o recargar. Cada layout conserva su modo.
- **Unidades separadas de venta:** el nuevo origen calcula porcentajes sobre unidades actuales. `Usar base original` recupera los cálculos originales sobre venta sin mezclarlos con CSV. Las tiendas CSV se muestran por CeCo; DT se determina por presencia de ese canal en el conjunto de semanas.
- **Carga estable:** valida encabezados, codificación, contexto, unidades y semana. Conserva ajustes negativos, omite copias idénticas y rechaza semanas conflictivas o filas repetidas. Una lectura fallida conserva el motor anterior.
- **Histórico:** agrega un CSV por semana; para corregir una semana reemplaza su archivo. El índice compacto consolida las semanas y concilia registros, unidades actuales y unidades AA por fuente. AA no se suma al cálculo actual.
- **PDF carta:** exporta el plan CAFÉ o DT activo, con mes, tienda y contexto, a una vista de impresión Carta vertical con márgenes de 12.7 mm. Pulsa `Imprimir o guardar PDF`. El layout ocupa la primera hoja y las rutinas continúan con encabezados repetidos, sin comprimirlas en una sola página. El diálogo de impresión debe conservar tamaño Carta y escala 100%; desactiva los encabezados y pies del navegador y conserva los gráficos de fondo.
- **PWA:** usa caché de interfaz V19, vuelve a consultar el índice y permite recuperar la última lectura. Los nombres, fotos, plays, rutinas, coordenadas, proporciones de columnas y el archivo `js/excel_data.js` se conservan.

### Publicación automática de futuras semanas

Una sola vez, selecciona **Settings → Pages → Build and deployment → Source → GitHub Actions** en este repositorio. El workflow incluido valida, genera el índice desde todos los CSV y publica sólo cuando las comprobaciones pasan. Los cambios en `main` activan el flujo; las solicitudes de cambio se validan sin publicar. No es necesario volver a subir los archivos pesados originales del motor.

Después coloca el CSV de cada semana en `data/motores/` y espera que termine **Validar y publicar PBT semanal**. La carpeta se mantiene visible en GitHub; el sitio publica el índice optimizado y sus recursos, sin descargar todos los CSV durante el arranque.

Si mantienes Pages desde la rama, ejecuta Python y sube también `data/motores/indice.json` cada vez que cambien los CSV:

```bash
python scripts/build_weekly_motor.py
python scripts/build_weekly_motor.py --check
python -m unittest discover -s tests -v
node --test tests/*.test.cjs
python scripts/audit_weekly_project.py
```

El generador y las pruebas nuevas utilizan la biblioteca estándar de Python y Node; no requieren instalar paquetes. Las reglas del motor se documentan en `data/motores/README.md`.

## V18 - Experiencia operativa y auditoría Python reproducible
- Se conserva íntegro el motor V17: coordenadas, plays, rutinas, filtros, Product Mix y cálculos no fueron reescritos.
- Nueva guía visual de tres pasos, jerarquía más clara, estados de carga y navegación accesible sin alterar el layout original.
- `data/project.json` centraliza **JUNTÉMONOS MÁS**, colores, propósito y pie de página operativo.
- `js/app.js` agrega caché LRU para consultas repetidas del motor y reduce recálculos durante la operación.
- El Service Worker instala primero la interfaz y almacena los archivos pesados del motor cuando se solicitan, acelerando la activación PWA.
- `scripts/audit_originals.py` valida de forma reproducible los tres Excel originales y genera `reports/audit-originals.json`.

### Resultado de auditoría
- 60,950 coordenadas: sin faltantes ni diferencias.
- 32,368 rutinas: sin faltantes ni diferencias.
- 459,256 claves de play: sin faltantes ni diferencias.
- 32,804 combinaciones de mix: sin faltantes ni diferencias.
- 714,212 filas de venta consolidadas en 67,079 grupos: sin grupos faltantes, extra o distintos; tolerancia de redondeo máxima de 0.01.
- 534 referencias únicas de la guía de fórmulas: todas dentro de las dimensiones del motor original.
- Transformación visual conservada: fila `+17`, columna `+1`, inicio `B18`, anchos `B:N = 9.08203125` y `O = 10.83203125`.

```bash
python scripts/audit_originals.py \
  --formula "Base PBT_Formula.xlsx" \
  --sales "Base_Order_MixProducto_Enero_Febrero_Abril.xlsx" \
  --pbt "PBT.24Desbloqueado.xlsx"
```

## V17 - Auditoría integral de coordenadas
- Se comprobaron las 60,950 claves contra `PBT.24Desbloqueado.xlsx` sin faltantes ni diferencias.
- El bloque G–E–F se conserva en D19:E19:F19 porque esa es la ubicación efectiva del original.
- La escala horizontal ahora respeta los anchos originales: B:N = 9.08203125 y O = 10.83203125.
- Se conservaron fórmulas, filtros, plays, rutinas, Fijo/No fijo, fotografías, almacenamiento local y PWA.

## V16 - Equipo y visual informativo
- La condición **Fijo / No fijo** permanece activa para los marcadores, pero se oculta como leyenda y columna visible.
- En **Equipo**, tocar la fotografía permite adjuntar o cambiar la imagen.
- Se agregó una acción independiente **Cámara** para capturar la foto directamente en dispositivos compatibles.
- Las fotografías continúan guardándose localmente y no modifican coordenadas, filtros ni rutinas.

## V15 - Auditoría integral PBT 2.0
- Ajuste de markers: Fijo = verde, No fijo = blanco con borde verde.
- Se eliminó override manual por letra para que respete la columna **Fijo** de rutinas.
- Coordenadas tomadas directamente de `EXCEL_DATA.coords` con layout Café / DT.
- Service Worker actualizado para limpiar caché anterior en GitHub Pages.
- Validación completa: 32,368 rutinas y 60,950 coordenadas sin valores inválidos.
- Leyenda accesible y atribución discreta agregadas.
- El fallback ya no deduce Fijo/No fijo por el punto de la letra; usa la fuente real o muestra estado sin dato.
