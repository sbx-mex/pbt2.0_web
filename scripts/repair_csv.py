#!/usr/bin/env python3
"""Exporta una copia CSV legible sin cambiar unidades ni sobrescribir el original."""
from __future__ import annotations
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import tempfile
try:
    from .build_weekly_motor import csv_table, decode, parse_motor
except ImportError:
    from build_weekly_motor import csv_table, decode, parse_motor


def repair(source: Path, output: Path) -> dict:
    source, output = source.resolve(), output.resolve()
    if source == output or output.exists():
        raise ValueError('La salida debe ser una copia nueva; no se sobrescribe ningún archivo.')
    before = parse_motor(source)
    table, _, delimiter, wrapped = csv_table(decode(source.read_bytes()), source.name)
    buffer = io.StringIO(newline='')
    writer = csv.writer(buffer, lineterminator='\n')
    writer.writerows(csv.reader(io.StringIO(table), delimiter=delimiter, strict=True))
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pbt-csv-', dir=output.parent) as temp:
        staged = Path(temp) / 'motor.csv'
        staged.write_text(buffer.getvalue(), encoding='utf-8-sig', newline='')
        after = parse_motor(staged)
        keys = ['week', 'rows', 'units', 'unitsAA', 'hasAA', 'negativeRows', 'dtStores']
        if before['rows'] != after['rows'] or any(before['file'][k] != after['file'][k] for k in keys):
            raise ValueError('La copia no concilia con el original; no se guarda.')
        # Exclusive creation also protects an output created concurrently.
        with output.open('xb') as stream:
            stream.write(staged.read_bytes())
    return {'estado':'VERDE', 'envoltura_recuperada':wrapped, 'origen_sha256':before['file']['sha256'],
            'salida_sha256':hashlib.sha256(output.read_bytes()).hexdigest(),
            **{key:before['file'][key] for key in keys}, 'salida':str(output)}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    try:
        print(json.dumps(repair(args.source, args.output), ensure_ascii=False, indent=2))
        return 0
    except (OSError, ValueError, csv.Error) as error:
        print(json.dumps({'estado':'ROJO', 'error':str(error)}, ensure_ascii=False))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
