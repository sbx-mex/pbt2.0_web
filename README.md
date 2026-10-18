# PBT Web 2.0 · V27

Mejora de arranque, navegación y publicación sobre `sbx-mex/pbt2.0_web`, commit `c3a5437ac01f2adff857d5bec99395eb13563793` del 18 de octubre de 2026. Conserva el motor original PBT.24, sus coordenadas, rutinas, desempates, calendario 4-4-5, porcentajes por unidades y formato de PDF carta.

## Abrir la copia lista del ZIP

Descomprime **todo el ZIP** y ejecuta **INICIAR_PBT.bat** en Windows. Requiere Python 3.10 o posterior. En macOS/Linux: `python3 iniciar.py`. Abre PBT en `http://127.0.0.1:8765/`; mantén abierta la consola. No abras `index.html` con doble clic.

La carpeta `PBT_LISTO` del paquete contiene el sitio preparado y los datos auditados. No necesita Node, paquetes Python, cuenta, ni conexión externa para abrirse mediante el servidor local. La URL y el navegador determinan dónde se guarda tu equipo: el equipo capturado en GitHub Pages no aparece automáticamente en localhost.

## Actualizar el repositorio

El ZIP incluye `actualizar_pbt.py` y `actualizacion/`. Desde la carpeta del ZIP:

```bash
python actualizar_pbt.py "RUTA_A_TU_REPOSITORIO"
python actualizar_pbt.py "RUTA_A_TU_REPOSITORIO" --aplicar
```

El primer comando revisa sin modificar. El segundo requiere Python 3.12 y Node 22 o posterior: comprueba la versión y las fuentes, valida una copia temporal, crea un respaldo y aplica sólo los archivos del paquete. Retira `js/data.js` y `icons/.gitkeep` sólo si su contenido coincide con el obsoleto auditado. Si encuentra cambios posteriores, se detiene para conservarlos. No borra CSV, nombres ni fotos. Revisa `git diff`, confirma los cambios y súbelos a `main`.

Restauración, antes de hacer nuevas ediciones:

```bash
python actualizar_pbt.py --restaurar "RUTA_DEL_RESPALDO" --aplicar
```

El respaldo se crea junto al repositorio. La restauración rechaza archivos editados después de instalar. Si hay cambios posteriores, el respaldo conserva los originales para recuperarlos manualmente.

## Publicación y carga

Conserva **Settings → Pages → Source → GitHub Actions**. El workflow `motores-semanales.yml` ejecuta Python antes de publicar. No subas la carpeta completa del ZIP a la raíz de GitHub: usa el instalador; `PBT_LISTO` es la copia local preparada.

- La interfaz aparece sin esperar el catálogo grande. Una descarga incompleta muestra un error con recuperación; no se exportan planes incompletos ni se inventa un plan para un solo partner.
- Python genera JSON y gzip con SHA-256; se verifica la descarga comprimida y su contenido. Navegadores sin descompresión nativa reciben el JSON verificado.
- El catálogo y el índice actuales pasan de 24.9 MB a 5.8 MB de carga útil, 76.8% menos en navegadores compatibles. Son bytes de datos; el tiempo real depende de la conexión y el equipo.
- Cada compilación genera una identificación de contenido para los recursos y la caché. No es necesario editar números de versión al agregar una semana.
- El plan queda disponible en la caché tras completar la instalación. Los motores guardados se recuperan al abrir sin red. La primera visita a GitHub Pages necesita conexión; borrar datos del navegador elimina los respaldos locales.
- Filtros, Plan y Rutinas tienen accesos directos; se mantienen Café/DT, búsqueda por CeCo, equipo por tienda y PDF.
- Scripts locales, sin ejecución inline ni `eval`. La publicación excluye CSV crudos, scripts de construcción y motor JS de 23.9 MB. El servidor local sólo sirve archivos públicos del sitio y escucha en este equipo.

## Revisión reproducible

Sin paquetes adicionales para los controles de Python/Node:

```bash
python scripts/validate_update.py --site _site
python iniciar.py --site _site
```

Usa una carpeta de salida nueva. Los siete controles de origen generan el catálogo y el índice, validan el directorio, ejecutan pruebas, concilian porcentajes y verifican fidelidad; una revisión adicional del sitio preparado comprueba enlaces, política de scripts y compresión. Se prueban las 459,256 búsquedas originales. El índice base tenía 26 semanas y los CSV actuales 31; siempre se reconstruye desde las fuentes antes de publicar.

El ZIP incluye un informe con resultados reales de las pruebas de navegador. Las comprobaciones automáticas no equivalen a una prueba física en cada teléfono. La seguridad de carga y publicación no añade autenticación: el repositorio y GitHub Pages conservan su visibilidad pública actual. No subas credenciales ni información privada al repositorio.
