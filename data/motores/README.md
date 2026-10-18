# Motores CSV semanales · V20

Coloca un CSV por semana en esta carpeta o en sus subcarpetas. La columna `Semana` identifica la semana como `AAAASS`; la fecha del encabezado del reporte no la sustituye. Una corrección reemplaza el CSV de esa misma semana. Copias idénticas se omiten; dos archivos diferentes de la misma semana se rechazan.

El lector acepta UTF-16 con BOM, UTF-8 o Windows-1252 y separadores coma, punto y coma o tabulación. Columnas requeridas: Tiendas, Semana, Clas_Semana, DayPart, Distribucion Canal, Mix de Producto y Unidades. Unidades AA es opcional: si no está completa, el comparativo se muestra como no disponible. Los ajustes negativos se conservan.

Los porcentajes usan **Unidades actuales** de los meses, tienda, días y turno seleccionados. Canal y producto comparten ese total. AA se conserva por el mismo segmento, sin sumarlo a actual. Los porcentajes visibles cierran a 100.0% con reparto de décimas por mayor residuo; las unidades se conservan sin modificar. Total no positivo o categorías con saldo negativo impiden generar porcentajes y plan.

La clasificación DT requiere alguna unidad DT actual o AA distinta de cero en las semanas cargadas; filas de ceros no bastan. COD corresponde a la clave interna Café filtrado. Lun–Jue y Vie–Dom son grupos distintos; no hay datos para separar sólo viernes y sábado.

Mes PBT 4-4-5: 01–04 Ene, 05–08 Feb, 09–13 Mar, 14–17 Abr, 18–21 May, 22–26 Jun, 27–30 Jul, 31–34 Ago, 35–39 Sep, 40–43 Oct, 44–47 Nov, 48–53 Dic. El mes siempre incluye el año.

Después de cambiar CSV ejecuta `python scripts/build_weekly_motor.py` y sube también `data/motores/indice.json` si Pages publica desde la rama. El índice V20 contiene unidades actuales y AA por segmento, huellas de fuentes y conciliación por semana. La publicación opcional por Actions genera ese archivo automáticamente; consulta el README principal.

En la aplicación, **Abrir carpeta CSV** y **Releer carpeta** leen los archivos locales en segundo plano. Se identifica la carpeta y se conserva el acceso cuando el navegador lo permite. Los archivos no se envían al servidor. Una lectura inválida o cancelada mantiene el motor anterior. Los respaldos V19 se recuperan sin inventar AA por segmento: relee la carpeta para actualizar su formato.
