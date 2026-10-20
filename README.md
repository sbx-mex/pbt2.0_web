# PBT Web 2.0 · corrección de carga S42

Sitio: https://sbx-mex.github.io/pbt2.0_web/

La lectura de motores recupera CSV cuyas filas fueron exportadas dentro de una sola celda. Python y JavaScript validan columnas, categorías, duplicados, unidades y AA sin modificar los CSV originales. El índice incluido contiene las semanas S01 a S42 de 2026.

## Publicación

Los archivos y carpetas de esta actualización van directamente en la raíz de `main`, conservando su estructura y sustituyendo las versiones anteriores. No subas el archivo ZIP como archivo del repositorio: extrae y sube su contenido.

Mantén **Settings → Pages → Source → GitHub Actions**. El workflow existente `motores-semanales.yml` reconstruye y valida el sitio antes de publicarlo. Conserva los CSV originales en `data/motores` y los demás archivos del repositorio.

## Validación local

Requiere Python 3.12 y Node 22 o posterior. Usa una carpeta de salida nueva:

```bash
python scripts/validate_update.py --site _site
python scripts/audit_sample_stores.py --output reports/muestra-tiendas.json
python iniciar.py --site _site
```

No abras `index.html` directamente; consulta el sitio preparado mediante el servidor local o GitHub Pages.

## Correcciones incluidas

- Lectura estricta de una capa adicional de CSV en Python y navegador.
- Índice y manifiesto reconstruidos para 42 semanas y 984 tiendas.
- Recuperación mediante JSON verificado si falla gzip; conserva controles de tamaño, SHA-256 y cancelación.
- Íconos de 192 y 512 píxeles optimizados e incluidos en la caché sin conexión.
- Pruebas de regresión y muestra reproducible de 10 tiendas, con seis contextos por tienda.

Sobre el commit base `00190126c9d0492d2be5eef8ba72122a42569d81` se aprobaron 45 pruebas Python, 102 pruebas Node, 3,888 conciliaciones y 60 casos adicionales sin diferencias. Se verificaron Café, DT, PDF, ZIP de 20 planes, vista móvil y recarga sin conexión. Se conservan el motor PBT.24, sus 459,256 búsquedas, el calendario 4-4-5 y las reglas de porcentajes por unidades.

Para obtener una copia convencional de un CSV sin sobrescribir el original:

```bash
python scripts/repair_csv.py "data/motores/Base_Canal_Mix de Producto_42.csv" --output "copias/semana42.csv"
```

No agregues una segunda versión de la misma semana dentro de `data/motores`.

Si el campo Website de About sigue apuntando a `sbx-mx.github.io`, corrígelo a `https://sbx-mex.github.io/pbt2.0_web/`. Ese ajuste pertenece a la configuración de GitHub.
