# PBT Web 2.0 · V22

Actualización de navegación y lectura de motores, fiel al plano, plays y rutinas originales.
Base revisada: `6106d44ad41a5d8e3731404c5e3a011bdb821958`.

## Diez mejoras

1. **Café / DT con teclado y foco claro.** Flechas, Inicio y Fin cambian de sección; cada entrada pide una tienda. Al volver a la app, Automático actualiza días y turno con el reloj del dispositivo.
2. **Búsqueda de tienda más precisa.** Prioriza CeCo exacto y nombre exacto; después prefijos y coincidencias. Flechas, Inicio, Fin y Enter recorren opciones anunciadas al lector de pantalla. Enter sobre una lista cerrada ya no selecciona una tienda oculta.
3. **Meses más simples.** Un desplegable con casillas y una sola acción “Todos los meses”. Conserva selección múltiple, cierra con Escape o al pulsar fuera, y evita una selección vacía ambigua. Días y turno siguen siendo de selección única.
4. **Estado de carga real.** “Cargando…” sólo mientras se prepara el motor. Si falla el primer motor, aparece una acción breve para reintentar. La base original sobre venta se activa únicamente al elegirla en Acerca de.
5. **Integridad de la publicación.** Python genera un manifiesto con SHA-256 y tamaño exacto del índice y de cada CSV. El navegador concilia manifiesto, índice y semanas antes de activar la fuente. Una publicación incompleta conserva la lectura válida.
6. **Histórico local sin sumar dos veces.** Agregar CSV a una lectura local conserva semanas anteriores. Una semana corregida reemplaza su versión; releer la misma semana no duplica unidades. Releer la misma carpeta conserva el histórico; abrir otra carpeta inicia una fuente distinta. La primera selección local parte de sus propios CSV y no mezcla datos publicados.
7. **Lectura cancelable y con límites.** Cancelar libera los controles y descarta resultados tardíos. Se revisan 25 MB por CSV, 128 archivos, 512 MB por lectura y 64 MB de índice; el proceso de análisis sigue en segundo plano. Los errores no reemplazan el motor activo.
8. **Recuperación de carpeta y fecha veraz.** Reabre el respaldo validado con la fecha de su lectura original. Si el navegador ya autoriza la carpeta, la relee al iniciar y añade semanas nuevas. Si falta permiso, conserva el respaldo y permite Releer; no solicita acceso en segundo plano.
9. **Respaldo sin conexión protegido.** Una página HTML devuelta como motor no reemplaza el JSON guardado. El respaldo informa su origen en Acerca de; se conserva la caché de los motores originales y se respetan otros proyectos.
10. **Actualización revisada con un comando.** Python genera índice y manifiesto mediante escritura atómica, revisa directorio, ejecuta las pruebas, concilia porcentajes y verifica el original. Sólo después prepara el sitio para Pages, sin publicar los CSV crudos, scripts o pruebas. El workflow correcto en `.github/` publica ese sitio tras aprobar la revisión.

## Subir el ZIP

Descomprime y reemplaza sus archivos en la raíz del repositorio, respetando las rutas. **`.github/workflows/motores-semanales.yml` lleva punto inicial.** `github/workflows/` no ejecuta Actions y no sustituye esa ruta. El ZIP excluye los CSV, Excel y motores originales que ya existen.

Incluye el índice y manifiesto de los veintidós CSV presentes al revisar esta versión. Para futuras semanas, conserva los CSV previos y añade el nuevo en `data/motores/`. El workflow genera el índice completo y publica el resultado validado desde `main`, sin la variable opcional requerida por V21.

Para tener un único proceso de publicación con esta puerta de validación, configura **Settings → Pages → Source → GitHub Actions**. Si continúa “Deploy from a branch”, GitHub mantiene además su publicación automática de esa rama; la nueva revisión y publicación son un proceso adicional. No se cambiaron ajustes del repositorio desde esta entrega. Espera los trabajos **validar** y **publicar** en “Validar PBT semanal”.

La publicación usa el mecanismo oficial de [actions/deploy-pages](https://github.com/actions/deploy-pages#security-considerations), desde la rama `main`, con permisos de Pages limitados al trabajo de publicación y acciones fijadas a SHA.

## Revisión en computadora de Back

Necesitas Python 3.10 o posterior y Node.js 18 o posterior. Sin dependencias Python adicionales:

```bash
python scripts/validate_update.py
```

Para preparar también una carpeta nueva lista para servir:

```bash
python scripts/validate_update.py --site salida-pbt
```

La salida sólo se crea después de aprobar los seis controles. No sobrescribe una carpeta ya existente. Para actualizar únicamente los motores y comprobarlos:

```bash
python scripts/build_weekly_motor.py
python scripts/build_weekly_motor.py --check
```

En publicación desde rama debes subir **índice y manifiesto juntos** después de generar. El workflow incluido lo resuelve en la compilación del sitio para Pages.

## Lo que se conserva

- Inicio vacío hasta seleccionar exactamente una tienda. Directorio_PBT cruza CeCo y tienda, sin inventar equivalencias. Los filtros de una fuente nueva se concilian; si una tienda o todos sus meses elegidos desaparecen, pide seleccionar de nuevo antes de ampliar el cálculo.
- Porcentajes enteros calculados sobre las unidades del filtro. Canal y producto cierran por separado a 100% mediante mayor residuo. AA no entra al denominador actual. Un contexto sin unidades válidas bloquea el plan y el PDF.
- Calendario original 4-4-5. Lun–Jue / Vie–Dom y Mañana / Intermedio / Tarde. Manual conserva la elección; Automático sigue el reloj local.
- `js/excel_data.js`, funciones del play, coordenadas, layout y rutinas originales permanecen sin cambios.
- PDF carta de la V21: margen de 12.7 mm, filtro y plan seleccionado, nombres sólo si están asignados, sin controles, instrucciones ni firma de diseño. Nombre `PBT_38333_lun-jue_Manana_4Partners.pdf`.
- Acerca de concentra instrucciones, fuente, archivos, unidades/AA, totales, equipo e información. La pantalla de trabajo conserva poco texto.

Evidencia de la entrega: `reports/audit-v22.json`. El verde local acredita el ZIP revisado; el nuevo despliegue se confirma en GitHub después de cargarlo.
