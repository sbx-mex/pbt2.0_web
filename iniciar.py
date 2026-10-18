#!/usr/bin/env python3
"""Abre PBT en este equipo, con Python estándar y sin exponer la carpeta fuente."""
from __future__ import annotations
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
from urllib.parse import unquote, urlsplit
import webbrowser

ROOT=Path(__file__).resolve().parent


class Handler(SimpleHTTPRequestHandler):
    def allowed(self):
        if self.headers.get('Host','').split(':')[0] not in {'127.0.0.1','localhost'}:
            return False
        raw=unquote(urlsplit(self.path).path)
        if '\\' in raw or '\x00' in raw:
            return False
        rel=raw.lstrip('/') or 'index.html'
        parts=Path(rel).parts
        if any(p in {'.','..'} or p.startswith('.') for p in parts):
            return False
        path=Path(self.directory)/rel
        if any(p.is_symlink() for p in [path,*path.parents]):
            return False
        if not path.is_file():
            return False
        return (rel in {'index.html','manifest.json','sw.js','build.json','data/project.json'} or
                (parts[0] in {'css','js','icons'} and path.suffix.lower() in {'.js','.css','.png','.svg'}) or
                (rel.startswith(('data/plan/','data/motores/')) and path.name in {'manifest.json','catalog.json','catalog.json.gz','indice.json','indice.json.gz'}))

    def do_GET(self):
        if not self.allowed():
            self.send_error(404);return
        super().do_GET()

    def do_HEAD(self):
        if not self.allowed():
            self.send_error(404);return
        super().do_HEAD()

    def list_directory(self,path):
        self.send_error(404);return None

    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff')
        self.send_header('Referrer-Policy','no-referrer')
        self.send_header('X-Frame-Options','DENY')
        self.send_header('Permissions-Policy','camera=(self), microphone=(), geolocation=()')
        self.send_header('Cache-Control','no-cache')
        super().end_headers()

    def log_message(self,format,*args):
        pass


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--site',type=Path)
    parser.add_argument('--port',type=int,default=8765)
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    site=args.site or next((p for p in [ROOT/'PBT_LISTO',ROOT/'_site'] if (p/'build.json').is_file()),ROOT/'_site')
    site=site.resolve()
    if not (site/'build.json').is_file() or not (site/'index.html').is_file():
        parser.error('Falta el sitio preparado. Ejecuta primero: python scripts/validate_update.py --site _site')
    try:
        server=ThreadingHTTPServer(('127.0.0.1',args.port),partial(Handler,directory=str(site)))
    except OSError:
        parser.error('El puerto está ocupado. Usa --port 8766 o cierra la otra ventana de PBT.')
    url=f'http://127.0.0.1:{server.server_port}/'
    print('PBT está listo: '+url+'\nMantén esta ventana abierta. Para salir: Ctrl+C.',flush=True)
    if not args.no_browser:
        threading.Timer(.4,lambda:webbrowser.open(url)).start()
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nPBT cerrado.')
    finally:
        server.server_close()


if __name__=='__main__':main()
