#!/usr/bin/env python3
"""Valida un ZIP PBT: sólo PDF al mismo nivel, nombres únicos y contenido íntegro."""
from __future__ import annotations
import argparse
from datetime import datetime
import json
from pathlib import Path
import re
import stat
import zipfile

MAX_FILES = 120
MAX_BYTES = 64 * 1024 * 1024


def audit(path, expected_count=None):
    path = Path(path)
    match = re.fullmatch(r'PBT_Planes_(\d+)_(\d{3,8}|VariosCeCo)_(\d{6})(?: ?\(\d+\))?\.zip', path.name)
    if not match:
        raise ValueError('Usa PBT_Planes_numero_CeCo_ddmmaa.zip.')
    count = int(match[1])
    datetime.strptime(match[3], '%d%m%y')
    if not 1 <= count <= MAX_FILES or expected_count is not None and count != expected_count:
        raise ValueError('La cantidad del nombre no coincide con la esperada.')
    with zipfile.ZipFile(path) as archive:
        files = archive.infolist()
        if len(files) != count:
            raise ValueError('La cantidad de PDF no coincide con el nombre del ZIP.')
        if sum(item.file_size for item in files) > MAX_BYTES:
            raise ValueError('El ZIP supera el límite de 64 MB.')
        names = set()
        for item in files:
            name = item.filename
            if (item.is_dir() or '/' in name or '\\' in name or len(name) > 255
                    or not re.fullmatch(r'PBT_[A-Za-z0-9_+.-]+\.pdf', name)
                    or name.casefold() in names):
                raise ValueError('Se requieren PDF únicos, todos al mismo nivel: ' + name)
            if item.flag_bits & 1 or stat.S_ISLNK(item.external_attr >> 16):
                raise ValueError('No se permiten archivos cifrados ni enlaces.')
            if match[2] != 'VariosCeCo' and not name.startswith('PBT_' + match[2] + '_'):
                raise ValueError('El CeCo del PDF no coincide con el ZIP.')
            names.add(name.casefold())
        if archive.testzip() is not None:
            raise ValueError('Falló la comprobación CRC del ZIP.')
        for item in files:
            with archive.open(item) as stream:
                if stream.read(5) != b'%PDF-':
                    raise ValueError('Contenido PDF inválido: ' + item.filename)
            content = archive.read(item)
            if b'%%EOF' not in content[-1024:]:
                raise ValueError('PDF incompleto: ' + item.filename)
    return {'estado': 'VERDE', 'pdfs': count, 'ceco': match[2],
            'fecha': match[3], 'todos_al_mismo_nivel': True,
            'solo_pdf': True, 'crc_correcto': True}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('zip', type=Path)
    parser.add_argument('--expected-count', type=int)
    args = parser.parse_args()
    try:
        print(json.dumps(audit(args.zip, args.expected_count), ensure_ascii=False))
        return 0
    except (OSError, ValueError, RuntimeError, zipfile.BadZipFile) as error:
        print(json.dumps({'estado': 'ROJO', 'error': str(error)}, ensure_ascii=False))
        return 1


if __name__ == '__main__':
    raise SystemExit(main())

