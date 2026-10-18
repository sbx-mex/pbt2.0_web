# Motores semanales

Coloca aquí un CSV de **Base Canal / Mix de Producto por semana**. Puedes organizar subcarpetas por año; Python las recorre. Conserva un archivo por semana `AAAASS` y reemplaza ese mismo archivo cuando corrijas una semana. Una copia idéntica se omite; dos versiones distintas de la misma semana detienen la actualización.

Los tres CSV iniciales son los originales recibidos, sin reescribir su contenido. El motor usa `Unidades` actuales; `Unidades AA` sólo se concilia como control y no se suma al cálculo actual. COD se integra como Café filtrado; Mañana, Intermedio y Tarde se asignan a Morning, Lunch y Afternoon. Lun–Jue es Weekday y Vie–Dom es Weekend. Los ajustes negativos se conservan.

El mes sigue la distribución 4-4-5 del PBT original: semanas 01–04 Ene, 05–08 Feb, 09–13 Mar, 14–17 Abr, 18–21 May, 22–26 Jun, 27–30 Jul, 31–34 Ago, 35–39 Sep, 40–43 Oct, 44–47 Nov y 48–53 Dic. Por ejemplo, `202601`, `202602` y `202603` corresponden a enero de 2026. Las fechas de los textos previos al encabezado son metadatos del reporte y no cambian la columna Semana.

Las tiendas se identifican por CeCo porque estos CSV no incluyen el nombre. Una tienda con canal DT en cualquiera de los motores cargados se clasifica como Drive Thru para mantener un catálogo único en ambos modos.

Para regenerar localmente:

```bash
python scripts/build_weekly_motor.py
python scripts/build_weekly_motor.py --check
```

`indice.json` es el archivo optimizado que lee el portal; incluye huellas de los CSV y sus totales. El workflow lo regenera antes de publicar, sin editar los archivos originales. La carga en el navegador cambia de origen sólo después de validar el conjunto completo.

También puedes usar **Abrir carpeta CSV** en la aplicación y **Releer carpeta** para detectar archivos agregados o reemplazados. La carpeta permanece identificada y, cuando el navegador lo permite, se recuerda su acceso. Si solicita permiso otra vez, vuelve a autorizar sólo la lectura. En navegadores sin acceso persistente usa **Elegir CSV** o vuelve a seleccionar la carpeta.
