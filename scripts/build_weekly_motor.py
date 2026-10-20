#!/usr/bin/env python3
"""Valida motores CSV semanales y genera un índice compacto para PBT Web 2.0."""
from __future__ import annotations

import argparse
from collections import defaultdict
import csv
from decimal import Decimal
import hashlib
import io
import json
import os
from pathlib import Path
import re
import tempfile

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / 'data/motores'
MAX_FILE = 25 * 1024 * 1024
MAX_TOTAL = 512 * 1024 * 1024
MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
HEADERS = ['Tiendas','Semana','Clas_Semana','DayPart','Distribucion Canal','Mix de Producto','Unidades']
DAYPARTS = {'1_Mañana':'Morning','2_Intermedio':'Lunch','3_Tarde':'Afternoon'}
WEEKPARTS = {'Lun-Jue':'Weekday','Vie-Dom':'Weekend'}
MIX = {'Espresso':5,'COD':6,'CBS':7,'Food':8,'Otro':9}
CHANNEL = {'Lobby':10,'Pick up & Delivery':11,'DT':12}


class MotorError(ValueError):
    pass


def decode(data: bytes) -> str:
    if data.startswith((b'\xff\xfe', b'\xfe\xff')):
        return data.decode('utf-16')
    try:
        return data.decode('utf-8-sig')
    except UnicodeDecodeError:
        return data.decode('cp1252')


def number(value: str) -> Decimal:
    value = str(value or '').strip()
    if not value:
        return Decimal(0)
    negative = value.startswith('(') and value.endswith(')')
    if negative:
        value = value[1:-1]
    elif value.startswith('-'):
        negative = True
        value = value[1:]
    if not re.fullmatch(r'(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?', value):
        raise MotorError('Unidades no numéricas: ' + value[:40])
    amount = Decimal(value.replace(',', ''))
    if amount > 1_000_000_000:
        raise MotorError('Unidades fuera de límite')
    return -amount if negative else amount


def week_info(value: str) -> dict:
    if not re.fullmatch(r'20\d{2}(?:0[1-9]|[1-4]\d|5[0-3])', value):
        raise MotorError('Semana inválida; se requiere AAAASS: ' + value)
    year, week = int(value[:4]), int(value[4:])
    # Original PBT: 4, 4, 5 weeks in each quarter. Week 53 remains in December.
    month = next(index for index, end in enumerate([4,8,13,17,21,26,30,34,39,43,47,53],1) if week <= end)
    return {'id':value, 'month':f'{year}-{month:02}', 'label':f'{MONTHS[month-1]} {year}'}



def csv_table(text: str, filename: str = 'CSV') -> tuple[str, int, str, bool]:
    """Recover exactly one full-row CSV envelope, never remove quotes blindly.

    Some spreadsheet exports wrap every record in one quoted cell. Detect the
    required header after a second CSV parse and require the same envelope on
    every data row. Normal CSV retains its existing quoting and delimiter.
    """
    lines = text.splitlines(keepends=True)
    for index, line in enumerate(lines[:100]):
        for delimiter in [',', ';', '\t']:
            try:
                fields = next(csv.reader([line], delimiter=delimiter, strict=True), [])
            except csv.Error:
                continue
            if all(name in fields for name in HEADERS):
                return ''.join(lines[index:]), index, delimiter, False
            if len(fields) != 1:
                continue
            try:
                nested = next(csv.reader(fields, delimiter=delimiter, strict=True), [])
            except csv.Error:
                continue
            if not all(name in nested for name in HEADERS):
                continue
            recovered = []
            for offset, outer in enumerate(csv.reader(io.StringIO(''.join(lines[index:])), delimiter=delimiter, strict=True), index + 1):
                if not outer:
                    continue
                if len(outer) != 1:
                    raise MotorError(f'{filename}:{offset}: envoltura CSV inconsistente; no se omiten registros')
                recovered.append(outer[0])
            return '\n'.join(recovered) + '\n', index, delimiter, True
    raise MotorError(f'{filename}: faltan columnas requeridas de Mix de Producto')


def parse_motor(path: Path) -> dict:
    if path.is_symlink() or not path.is_file() or not 0 < path.stat().st_size <= MAX_FILE:
        raise MotorError(f'CSV ausente, vacío o mayor a 25 MB: {path.name}')
    data = path.read_bytes()
    text = decode(data)
    table, header_line, delimiter, wrapped = csv_table(text, path.name)
    reader = csv.DictReader(io.StringIO(table), delimiter=delimiter, strict=True)
    if len(reader.fieldnames) != len(set(reader.fieldnames)):
        raise MotorError(f'{path.name}: encabezados duplicados')
    groups = {}
    stores_dt = set()
    seen = set()
    weeks = set()
    rows, units, units_aa, negatives = 0, Decimal(0), Decimal(0), 0
    has_aa = 'Unidades AA' in reader.fieldnames
    for offset, row in enumerate(reader, header_line+2):
        if all(value in ('', None) for value in row.values()):
            continue
        if None in row or any(row.get(key) is None for key in HEADERS):
            raise MotorError(f'{path.name}:{offset}: fila con columnas incompletas')
        row = {key: str(value or '').strip() for key,value in row.items()}
        code, week = row['Tiendas'], row['Semana']
        if not re.fullmatch(r'\d{3,8}', code):
            raise MotorError(f'{path.name}:{offset}: CeCo inválido')
        week_info(week)
        weeks.add(week)
        if len(weeks) > 1:
            raise MotorError(f'{path.name}: conserva una semana por motor CSV')
        if row['DayPart'] not in DAYPARTS or row['Clas_Semana'] not in WEEKPARTS or row['Mix de Producto'] not in MIX or row['Distribucion Canal'] not in CHANNEL:
            raise MotorError(f'{path.name}:{offset}: categoría, canal o contexto desconocido')
        key = tuple(row[field] for field in HEADERS[:-1])
        if key in seen:
            raise MotorError(f'{path.name}:{offset}: registro duplicado en la misma semana')
        seen.add(key)
        amount, aa = number(row['Unidades']), number(row.get('Unidades AA', ''))
        has_aa = has_aa and row.get('Unidades AA', '') != ''
        dim = (code, week, DAYPARTS[row['DayPart']], WEEKPARTS[row['Clas_Semana']])
        target = groups.setdefault(dim, [*dim,*([Decimal(0)]*9),0,*([Decimal(0)]*9)])
        target[4] += amount
        target[MIX[row['Mix de Producto']]] += amount
        target[CHANNEL[row['Distribucion Canal']]] += amount
        target[13] += 1
        target[14] += aa
        target[MIX[row['Mix de Producto']]+10] += aa
        target[CHANNEL[row['Distribucion Canal']]+10] += aa
        if row['Distribucion Canal'] == 'DT' and (amount != 0 or aa != 0):
            stores_dt.add(code)
        rows += 1
        units += amount
        units_aa += aa
        negatives += int(amount < 0)
        if rows > 250_000:
            raise MotorError(f'{path.name}: excede 250,000 registros')
    if not rows:
        raise MotorError(f'{path.name}: sin registros')
    return {'file':{'path':path.name, 'sha256':hashlib.sha256(data).hexdigest(), 'bytes':len(data), 'week':next(iter(weeks)), 'rows':rows, 'units':float(units), 'unitsAA':float(units_aa), 'hasAA':bool(has_aa), 'dtStores':sorted(stores_dt), 'negativeRows':negatives}, 'rows':list(groups.values()), 'dt':stores_dt}


def build(folder: Path = FOLDER) -> dict:
    files = sorted(path for path in folder.rglob('*') if path.suffix.lower()=='.csv')
    if not files or len(files) > 128 or sum(p.stat().st_size for p in files) > MAX_TOTAL:
        raise MotorError('Selecciona entre 1 y 128 motores CSV; máximo 512 MB en total')
    records, groups, duplicates, week_files, fingerprints, dt = [], [], [], {}, set(), set()
    for path in files:
        parsed = parse_motor(path)
        meta = parsed['file']
        meta['path'] = path.relative_to(folder).as_posix()
        if meta['sha256'] in fingerprints:
            duplicates.append(meta['path'])
            continue
        if meta['week'] in week_files:
            raise MotorError(f"Dos motores diferentes para semana {meta['week']}: {week_files[meta['week']]} y {meta['path']}. Conserva una versión.")
        fingerprints.add(meta['sha256'])
        week_files[meta['week']] = meta['path']
        records.append(meta)
        groups.extend(parsed['rows'])
        dt.update(parsed['dt'])
    groups.sort(key=lambda row: row[:4])
    stores = sorted({row[0] for row in groups})
    return {'schema':2, 'basis':'units', 'calendar':'PBT-445', 'files':records, 'duplicates':duplicates, 'weeks':[week_info(value) for value in sorted(week_files)], 'stores':[[code, 'DT' if code in dt else 'CAFE'] for code in stores], 'rows':[[(int(value) if value == value.to_integral_value() else float(value)) if isinstance(value, Decimal) else value for value in row] for row in groups]}


def serialize(pack: dict) -> str:
    return json.dumps(pack, ensure_ascii=False, separators=(',',':'), allow_nan=False)+'\n'


def manifest_for(pack: dict, text: str) -> dict:
    data = text.encode('utf-8')
    if len(data) > 64 * 1024 * 1024:
        raise MotorError('El índice supera 64 MB; divide el histórico antes de publicar')
    return {'schema':1, 'index':{'path':'indice.json','bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()},
            'files':[{key:file[key] for key in ['path','week','sha256','bytes']} for file in pack['files']]}


def atomic_write(path: Path, text: str) -> None:
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, prefix=path.name+'.', suffix='.tmp', delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(text.encode('utf-8'));stream.flush();os.fsync(stream.fileno())
        temporary.replace(path)
    finally:
        if temporary and temporary.exists():temporary.unlink()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--folder', type=Path, default=FOLDER)
    parser.add_argument('--check', action='store_true', help='Comprueba que el índice ya coincide con los CSV')
    args = parser.parse_args()
    try:
        pack = build(args.folder)
        text = serialize(pack)
        manifest_text = serialize(manifest_for(pack, text))
        output = args.folder/'indice.json'
        manifest_output = args.folder/'manifest.json'
        if args.check:
            if not output.exists() or output.read_text(encoding='utf-8') != text or not manifest_output.exists() or manifest_output.read_text(encoding='utf-8') != manifest_text:
                raise MotorError('Índice desactualizado: ejecuta python scripts/build_weekly_motor.py')
        else:
            atomic_write(output, text)
            atomic_write(manifest_output, manifest_text)
        print(json.dumps({'estado':'VERDE','semanas':len(pack['weeks']),'motores':len(pack['files']),'registros':sum(meta['rows'] for meta in pack['files']),'unidades':sum(meta['units'] for meta in pack['files']),'grupos':len(pack['rows']),'indice_bytes':len(text.encode('utf-8'))}, ensure_ascii=False))
        return 0
    except (MotorError, UnicodeError, csv.Error, OSError) as error:
        print(json.dumps({'estado':'ROJO','error':str(error)}, ensure_ascii=False))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
