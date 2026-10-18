# PBT Web 2.0 · V23

Actualización de `sbx-mex/pbt2.0_web`, sobre `185adab108e3fb2b1099399d288e06ed0a33329c`.

## Subir el ZIP

1. Descomprime y reemplaza los archivos en la **raíz del repositorio**, conservando las carpetas. No subas el ZIP cerrado ni una carpeta contenedora adicional.
2. Reemplaza también **`.github/workflows/motores-semanales.yml`**, con el punto inicial. Ese archivo corrige el error de la captura: «La publicación debe depender de la revisión completa».
3. Para publicar únicamente la versión validada, usa **Settings → Pages → Source → GitHub Actions**. En Actions, espera que terminen `validar` y `publicar`. [Configuración oficial de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site#publishing-with-a-custom-github-actions-workflow).

El paquete contiene sólo archivos nuevos o modificados. Conserva tus CSV en `data/motores/` y los demás archivos del proyecto. `js/data.js` se reemplaza por un archivo vacío de datos para retirar el cubo de venta anterior; la app y el sitio generado ya no lo cargan.

## Diez cambios útiles

1. **CSV como única fuente de porcentajes.** Se elimina la selección «Usar base original» y cualquier retorno al cálculo sobre venta.
2. **Búsqueda por CeCo y tienda.** Acepta acentos, prefijos CeCo y código junto al nombre. El directorio aporta nombres; sólo aparecen tiendas existentes en los motores.
3. **Equipo en la parte principal.** Botón junto a Café y DT para registrar nombres y fotos. Abre el equipo de la sección activa.
4. **Menos carga inicial.** Se retira el cubo de venta de casi 6 MB y Equipo se construye cuando se abre. Se conservan nombres, fotos y lecturas CSV guardadas.
5. **Plano con fondos del Excel.** Python extrae las celdas, colores, anchos y rótulos originales. Las coordenadas, plays y rutinas permanecen iguales.
6. **PDF con el acomodo original.** Período y comentarios arriba; información de turno, canales y mix debajo; luego plano y rutinas. Carta con margen de 12.7 mm.
7. **Período resumido.** `Ene - Jun`, sin año. Meses separados se muestran como `Ene, Mar - Abr` para no incluir meses que no elegiste. El año se conserva internamente al filtrar.
8. **Comentario dinámico.** Incluye CeCo/tienda, meses, días, turno y referencia al trimestre actual estimado. No representa un pronóstico calculado de unidades.
9. **Créditos actualizados.** Enrique César Flores & Jorge Antonio Alcantar Aguiar. Se elimina la etiqueta de distrito anterior.
10. **Publicación después de validar.** Una sola revisión genera el índice y manifiesto, verifica Python/JavaScript, concilia porcentajes y prepara el sitio. Un error bloquea su publicación.

Los porcentajes continúan sin decimales y cada distribución cierra a 100% sobre las unidades del filtro. DT se reconoce por evidencia en los CSV. No se muestran datos ni se permite exportar hasta elegir una tienda con información válida.

## Actualizar motores

Sube un CSV por semana a `data/motores/`. GitHub Actions recompila todas las semanas antes de publicar. Una lectura local se abre en **Acerca de → Motores CSV**: agrega semanas al histórico y reemplaza una semana corregida sin duplicarla. La lectura de una carpeta diferente inicia otra fuente.

El PDF toma exactamente el filtro activo. Su nombre sigue `PBT_CeCo_lun-jue_o_vie-dom_Turno_NPartners.pdf`. Sólo imprime nombres asignados. Las pruebas de Café con 10 partners y DT con 13 caben en una página; contenido excepcionalmente largo continúa en otra página con su encabezado.

## Revisión reproducible

Python 3.12 y Node 22, sin instalar dependencias para la revisión de la app:

```bash
python scripts/validate_update.py --site _site
```

Usa una carpeta de salida nueva. No genera un sitio si falla alguno de los seis controles. El reporte de esta entrega está en `reports/audit-v23.json`; corresponde a pruebas locales, no a una ejecución ya publicada en GitHub.

La plantilla visual se puede volver a comprobar con el Excel original:

```bash
python scripts/build_sheet_template.py "PBT.24Desbloqueado(4).xlsx" --check
```

Diseñado por Enrique César Flores & Jorge Antonio Alcantar Aguiar
