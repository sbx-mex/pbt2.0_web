#!/usr/bin/env python3
"""Una sola revisión de actualización; prepara el sitio sólo después de aprobarla."""
import argparse
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

ROOT=Path(__file__).resolve().parents[1]

def stage_site(destination):
    destination=Path(destination).resolve()
    try:relative=destination.relative_to(ROOT)
    except ValueError:relative=None
    if relative is not None and (not relative.parts or relative.parts[0] in {'js','css','icons','data','scripts','tests','.git','.github'}):
        raise ValueError('Elige una carpeta de salida fuera de los archivos fuente del proyecto.')
    if destination.exists():raise ValueError('La carpeta de salida ya existe; usa una carpeta vacía nueva.')
    destination.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='pbt-validado-',dir=destination.parent) as temporary:
        stage=Path(temporary)/'site';stage.mkdir()
        for name in ['index.html','manifest.json','sw.js']:shutil.copy2(ROOT/name,stage/name)
        for name in ['css','icons','js']:shutil.copytree(ROOT/name,stage/name)
        (stage/'data/motores').mkdir(parents=True)
        shutil.copy2(ROOT/'data/project.json',stage/'data/project.json')
        for name in ['indice.json','manifest.json']:shutil.copy2(ROOT/'data/motores'/name,stage/'data/motores'/name)
        (stage/'.nojekyll').touch()
        stage.rename(destination)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--site',type=Path);args=parser.parse_args()
    if args.site and args.site.exists():parser.error('La carpeta de salida ya existe; usa otra ruta.')
    checks=[[sys.executable,'scripts/build_weekly_motor.py'],
            [sys.executable,'scripts/build_store_directory.py','--check'],
            [sys.executable,'-m','unittest','discover','-s','tests','-v'],
            ['node','--test',*[str(p.relative_to(ROOT)) for p in sorted((ROOT/'tests').glob('*.test.cjs'))]],
            [sys.executable,'scripts/audit_percentages.py'],
            [sys.executable,'scripts/audit_weekly_project.py']]
    try:
        for command in checks:subprocess.run(command,cwd=ROOT,check=True)
        if args.site:stage_site(args.site)
        print(json.dumps({'estado':'VERDE','revision':'6 controles aprobados','sitio':str(args.site) if args.site else None},ensure_ascii=False))
        return 0
    except (subprocess.CalledProcessError,OSError,ValueError) as error:
        print(json.dumps({'estado':'ROJO','error':str(error),'sitio_publicado':False},ensure_ascii=False));return 1

if __name__=='__main__':raise SystemExit(main())
