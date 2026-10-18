#!/usr/bin/env python3
"""Prepare verified compressed payloads and a content-derived release for Pages."""
from __future__ import annotations
import gzip
import hashlib
import json
from pathlib import Path
import re


def metadata(path: Path) -> dict:
    data = path.read_bytes()
    return {'path': path.name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def compress(path: Path) -> dict:
    zipped = path.with_suffix(path.suffix + '.gz')
    zipped.write_bytes(gzip.compress(path.read_bytes(), compresslevel=9, mtime=0))
    return {**metadata(path), 'gzip': metadata(zipped)}


def prepare(root: Path, site: Path) -> dict:
    catalog = (root/'js/plan-catalog.js').read_text(encoding='utf-8')
    match = re.search(r' const data=(.*);\n', catalog)
    if not match:
        raise ValueError('No se encontró el catálogo validado.')
    payload = json.loads(match[1])
    directory = site/'data/plan'
    directory.mkdir(parents=True)
    plain = directory/'catalog.json'
    plain.write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':'), allow_nan=False)+'\n', encoding='utf-8')
    plan = {'schema': 1, 'index': compress(plain)}
    (directory/'manifest.json').write_text(json.dumps(plan, separators=(',', ':'))+'\n', encoding='utf-8')
    motors = site/'data/motores'
    manifest = json.loads((motors/'manifest.json').read_text(encoding='utf-8'))
    manifest['index'] = compress(motors/'indice.json')
    (motors/'manifest.json').write_text(json.dumps(manifest, separators=(',', ':'))+'\n', encoding='utf-8')
    sw=site/'sw.js'
    plan_files={'manifest':'./data/plan/manifest.json?v=27','gzip':'./data/plan/catalog.json.gz?sha256='+plan['index']['gzip']['sha256'],'plain':'./data/plan/catalog.json?sha256='+plan['index']['sha256']}
    sw.write_text(sw.read_text(encoding='utf-8').replace('const PLAN_FILES={};','const PLAN_FILES='+json.dumps(plan_files,separators=(',',':'))+';'),encoding='utf-8')
    # Every deployment gets its own asset URLs and cache. Weekly uploads cannot
    # combine an old application shell with a new module bearing the same URL.
    fingerprint = hashlib.sha256()
    for path in sorted(site.rglob('*')):
        if path.is_file():
            fingerprint.update(path.relative_to(site).as_posix().encode())
            fingerprint.update(path.read_bytes())
    release = fingerprint.hexdigest()[:16]
    for path in sorted(site.rglob('*')):
        if path.is_file() and path.suffix in {'.html', '.js', '.css'}:
            value = path.read_text(encoding='utf-8').replace('?v=27', '?v='+release).replace('__PBT_BUILD__', release)
            path.write_text(value, encoding='utf-8')
    baseline = len(catalog.encode()) + manifest['index']['bytes']
    transferred = plan['index']['gzip']['bytes'] + manifest['index']['gzip']['bytes']
    result = {'version': '27', 'release': release, 'payload_original_bytes': baseline,
              'payload_compressed_bytes': transferred, 'reduction_percent': round((1-transferred/baseline)*100, 1),
              'plan': plan['index'], 'motor': manifest['index']}
    (site/'build.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    return result
