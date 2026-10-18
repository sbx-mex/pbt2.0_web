#!/usr/bin/env python3
"""Limpieza acotada y control de publicación de PBT; biblioteca estándar."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import sys
import urllib.error
import urllib.request

REPOSITORY = 'sbx-mex/pbt2.0_web'
OBSOLETE = {
    'js/data.js': ('4c71e8ce748dc4a5edeb3723e1e3496544ea3bab44f4cec928ff5e015a553b97', '91197c612be385d7965c67eda5cba41f225aaa9b'),
    'icons/.gitkeep': ('01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b', '8b137891791fe96927ad78e64b0aad7bded08bdc'),
}


def clean(root: Path, apply=False):
    root = root.resolve()
    matches = []
    # Comprobar toda la lista antes de borrar el primer archivo.
    for relative, (sha256, _) in OBSOLETE.items():
        path = root / relative
        cursor = path
        while cursor != root:
            if cursor.is_symlink():
                raise ValueError('No se permiten enlaces simbólicos: ' + relative)
            cursor = cursor.parent
        if not path.exists():
            continue
        if not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != sha256:
            raise ValueError('Se conserva el archivo modificado; revisar manualmente: ' + relative)
        matches.append(relative)
    if apply:
        for relative in matches:
            (root / relative).unlink()
    return {'modo': 'aplicar' if apply else 'simular', 'obsoletos': matches}


class GitHub:
    def __init__(self):
        if os.environ.get('GITHUB_REPOSITORY') != REPOSITORY:
            raise ValueError('Repositorio no autorizado por este parche.')
        self.token = os.environ.get('GH_TOKEN', '')
        if not self.token:
            raise ValueError('Falta el token temporal del workflow.')

    def __call__(self, method, resource, data=None):
        request = urllib.request.Request(
            'https://api.github.com/repos/' + REPOSITORY + '/' + resource,
            data=None if data is None else json.dumps(data).encode(), method=method,
            headers={'Authorization': 'Bearer ' + self.token, 'Accept': 'application/vnd.github+json',
                     'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'PBT-CI',
                     'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            raise RuntimeError('GitHub rechazó ' + method + ' ' + resource +
                               ' (HTTP ' + str(error.code) + '). Revisar permisos/reglas; no se omiten.') from None


def validate_sha(value):
    if not re.fullmatch(r'[0-9a-f]{40}', value):
        raise ValueError('Se requiere el SHA completo de la versión validada.')
    return value


def current(api, expected):
    validate_sha(expected)
    head = api('GET', 'git/ref/heads/main')['object']['sha']
    return {'current': head == expected, 'sha': head}


def persist(api, expected):
    """Un único commit de borrados conocidos; nunca fuerza ni mezcla cambios nuevos."""
    validate_sha(expected)
    state = current(api, expected)
    if not state['current']:
        return {**state, 'deleted': [], 'reason': 'Hay una carga más reciente; no se publica esta versión.'}
    commit = api('GET', 'git/commits/' + expected)
    base_tree = commit['tree']['sha']
    tree = api('GET', 'git/trees/' + base_tree + '?recursive=1')
    if tree.get('truncated'):
        raise ValueError('GitHub devolvió un árbol incompleto; no se borra nada.')
    entries = {entry['path']: entry for entry in tree['tree']}
    deletions = []
    for path, (_, blob_sha) in OBSOLETE.items():
        entry = entries.get(path)
        if entry is None:
            continue
        if entry.get('type') != 'blob' or entry.get('mode') != '100644' or entry['sha'] != blob_sha:
            raise ValueError('Se conserva el obsoleto modificado: ' + path)
        deletions.append({'path': path, 'mode': '100644', 'type': 'blob', 'sha': None})
    if not deletions:
        return {**state, 'deleted': []}
    new_tree = api('POST', 'git/trees', {'base_tree': base_tree, 'tree': deletions})
    new_commit = api('POST', 'git/commits', {
        'message': 'PBT: retirar obsoletos verificados después de validar',
        'tree': new_tree['sha'], 'parents': [expected]})
    # Una carga concurrente nunca se sobreescribe: el ref sólo avanza sin force.
    if not current(api, expected)['current']:
        return {'current': False, 'sha': expected, 'deleted': [], 'reason': 'Cambió main durante la limpieza.'}
    api('PATCH', 'git/refs/heads/main', {'sha': new_commit['sha'], 'force': False})
    return {'current': True, 'sha': new_commit['sha'], 'deleted': [v['path'] for v in deletions]}


def output(result):
    print(json.dumps(result, ensure_ascii=False))
    target = os.environ.get('GITHUB_OUTPUT')
    if target and 'current' in result:
        with open(target, 'a', encoding='utf-8') as stream:
            stream.write('current=' + str(result['current']).lower() + '\nsha=' + result['sha'] + '\n')
    summary = os.environ.get('GITHUB_STEP_SUMMARY')
    if summary:
        with open(summary, 'a', encoding='utf-8') as stream:
            stream.write('\n### PBT: control de limpieza y versión\n\n```json\n' +
                         json.dumps(result, ensure_ascii=False, indent=2) + '\n```\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['clean', 'persist', 'check-head'])
    parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--expected-sha', default=os.environ.get('GITHUB_SHA', ''))
    args = parser.parse_args()
    try:
        if args.command == 'clean':
            result = clean(args.root, args.apply)
        else:
            if os.environ.get('GITHUB_REF') != 'refs/heads/main' or os.environ.get('GITHUB_EVENT_NAME') not in {'push', 'workflow_dispatch'}:
                raise ValueError('La escritura/publicación se admite sólo desde main; nunca desde un PR.')
            api = GitHub()
            result = persist(api, args.expected_sha) if args.command == 'persist' else current(api, args.expected_sha)
        output(result)
        return 0
    except (OSError, ValueError, RuntimeError) as error:
        print('ERROR PBT: ' + str(error), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())

