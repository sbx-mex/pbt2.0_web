#!/usr/bin/env python3
"""Install a reviewed PBT patch with conflict checks, backup and rollback."""
from __future__ import annotations
import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import uuid


class UpdateError(ValueError):
    pass


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None


def safe(root,relative):
    if not isinstance(relative,str) or '\\' in relative:
        raise UpdateError('Ruta no válida en el paquete.')
    parts=Path(relative).parts
    if not parts or Path(relative).is_absolute() or '..' in parts or parts[0] in {'.git','.env'}:
        raise UpdateError('Ruta no válida en el paquete: '+relative)
    path=root/relative
    if any(item.is_symlink() for item in [path,*path.parents]):
        raise UpdateError('No se modifican enlaces simbólicos: '+relative)
    return path


def atomic_copy(source,destination):
    destination.parent.mkdir(parents=True,exist_ok=True)
    fd,name=tempfile.mkstemp(prefix='.pbt-',dir=destination.parent)
    os.close(fd)
    try:
        shutil.copy2(source,name)
        os.replace(name,destination)
    finally:
        Path(name).unlink(missing_ok=True)


def validate(stage):
    if shutil.which('node') is None:
        raise UpdateError('Instala Node 22 o posterior para validar la actualización. La copia PBT_LISTO sólo necesita Python.')
    subprocess.run([sys.executable,'scripts/validate_update.py','--site','_pbt_validation'],cwd=stage,check=True)


def plan(bundle,target):
    manifest=json.loads((bundle/'update-manifest.json').read_text(encoding='utf-8'))
    if manifest.get('schema')!=1:raise UpdateError('Paquete incompatible.')
    for item in manifest.get('sources',[]):
        if sha(safe(target,item['path']))!=item['sha256']:raise UpdateError('Cambió una fuente desde la auditoría: '+item['path'])
    if 'csv_paths' in manifest:
        actual=sorted(p.relative_to(target).as_posix() for p in (target/'data/motores').rglob('*') if p.suffix.lower()=='.csv')
        if actual!=manifest['csv_paths']:raise UpdateError('La lista de CSV cambió después de la auditoría. Conserva tus datos y genera un paquete nuevo.')
    result=[];seen=set()
    for item in manifest['files']:
        rel=item['path']
        if rel in seen:raise UpdateError('Ruta duplicada: '+rel)
        seen.add(rel);dest=safe(target,rel);source=safe(bundle/'actualizacion',rel)
        expected=item['sha256']
        if sha(source)!=expected:raise UpdateError('Archivo del ZIP incompleto: '+rel)
        current=sha(dest)
        if dest.exists() and not dest.is_file():raise UpdateError('La ruta no es un archivo: '+rel)
        if current not in {item['previous_sha256'],expected}:
            raise UpdateError('El archivo cambió desde la versión auditada: '+rel+'. Se conserva sin tocar.')
        if current!=expected:result.append({'path':rel,'before':current,'after':expected,'source':source})
    for item in manifest['obsolete']:
        dest=safe(target,item['path']);current=sha(dest)
        if current==item['sha256']:
            result.append({'path':item['path'],'before':current,'after':None,'source':None})
        elif current is not None:print('Se conserva el obsoleto modificado: '+item['path'])
    return result


def restore(backup):
    record=json.loads((backup/'restore.json').read_text(encoding='utf-8'))
    target=Path(record['target'])
    for item in record['files']:
        if sha(safe(target,item['path']))!=item['after']:
            raise UpdateError('Hay cambios posteriores en '+item['path']+'. Se conserva tu trabajo; recupera el original desde el respaldo.')
    for item in record['files']:
        if item['before'] is not None and sha(safe(backup/'originales',item['path']))!=item['before']:raise UpdateError('Respaldo dañado: '+item['path'])
    for item in reversed(record['files']):
        dest=safe(target,item['path'])
        if item['before'] is None:dest.unlink(missing_ok=True)
        else:
            original=safe(backup/'originales',item['path'])
            if sha(original)!=item['before']:raise UpdateError('Respaldo dañado: '+item['path'])
            atomic_copy(original,dest)
    print('Versión anterior restaurada: '+str(target))


def install(bundle,target,apply=False,validator=validate):
    bundle=Path(bundle).resolve();target=Path(target).resolve()
    if target==bundle or not (target/'index.html').is_file() or not (target/'js/excel_data.js').is_file() or not (target/'data/motores').is_dir():
        raise UpdateError('Elige la raíz de tu copia de pbt2.0_web, con index.html, js/excel_data.js y data/motores.')
    changes=plan(bundle,target)
    print(f'Archivos por actualizar: {sum(x["after"] is not None for x in changes)}. Obsoletos verificados: {sum(x["after"] is None for x in changes)}.')
    if not apply:
        print('Revisión sin cambios. Para instalar, añade --aplicar.');return None
    if not changes:
        print('La actualización ya está aplicada.');return None
    lock=target/'.pbt-update.lock'
    try:
        fd=os.open(lock,os.O_CREAT|os.O_EXCL|os.O_WRONLY);os.close(fd)
    except FileExistsError:raise UpdateError('Hay otra actualización en curso: '+str(lock))
    try:
        with tempfile.TemporaryDirectory(prefix='pbt-validacion-') as temporary:
            stage=Path(temporary)/'repo'
            shutil.copytree(target,stage,symlinks=True,ignore=shutil.ignore_patterns('.git','_site','_pbt_validation','__pycache__','.pbt-update.lock','PBT_LISTO'))
            for item in changes:
                dest=safe(stage,item['path'])
                if item['source']:atomic_copy(item['source'],dest)
                else:dest.unlink(missing_ok=True)
            validator(stage)
            plan(bundle,target)
            # Re-check before writing; a build or manual edit during validation is a conflict.
            for item in changes:
                if sha(safe(target,item['path']))!=item['before']:raise UpdateError('El proyecto cambió durante la revisión: '+item['path'])
            backup=target.parent/('PBT_respaldo_'+datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')+'_'+uuid.uuid4().hex[:6])
            backup.mkdir()
            for item in changes:
                if item['before'] is not None:
                    original=safe(backup/'originales',item['path']);original.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(safe(target,item['path']),original)
            completed=[]
            try:
                for item in changes:
                    dest=safe(target,item['path'])
                    if item['source']:atomic_copy(item['source'],dest)
                    else:dest.unlink()
                    completed.append({k:item[k] for k in ['path','before','after']})
                    (backup/'restore.json').write_text(json.dumps({'target':str(target),'files':completed},ensure_ascii=False,indent=2),encoding='utf-8')
            except Exception:
                if completed:restore(backup)
                raise
            print('Actualización validada y aplicada. Respaldo: '+str(backup))
            print('Revisa git diff y publica los cambios en main. GitHub Actions volverá a validar antes de publicar.')
            return backup
    finally:
        lock.unlink(missing_ok=True)


def main(bundle=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('destino',type=Path,nargs='?')
    parser.add_argument('--aplicar',action='store_true')
    parser.add_argument('--restaurar',type=Path)
    args=parser.parse_args()
    try:
        if args.restaurar:
            if not args.aplicar:parser.error('Para restaurar añade --aplicar.')
            restore(args.restaurar.resolve())
        elif args.destino:install(bundle or Path(__file__).resolve().parents[2],args.destino,args.aplicar)
        else:parser.error('Indica la carpeta local de pbt2.0_web.')
    except (OSError,ValueError,subprocess.CalledProcessError) as error:
        print('No se completó la actualización: '+str(error),file=sys.stderr);return 1
    return 0


if __name__=='__main__':raise SystemExit(main())
