#!/usr/bin/env python3
"""Puerta local/CI: fuentes, motor original, enlaces, calendario y exportación carta."""
from __future__ import annotations
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import subprocess
try:
    from .build_weekly_motor import ROOT, build, serialize, week_info, manifest_for
    from .build_store_directory import read_compiled
except ImportError:
    from build_weekly_motor import ROOT, build, serialize, week_info, manifest_for
    from build_store_directory import read_compiled

class Links(HTMLParser):
    def __init__(self):super().__init__();self.paths=[];self.ids=[]
    def handle_starttag(self,tag,attrs):
        values=dict(attrs)
        if values.get('id'):self.ids.append(values['id'])
        for key in ['src','href']:
            value=values.get(key,'')
            if value and not value.startswith(('#','http:','https:','data:')):self.paths.append(value.split('?')[0])

def audit(root: Path=ROOT) -> dict:
    html=(root/'index.html').read_text(encoding='utf-8')
    parser=Links();parser.feed(html)
    assert len(parser.ids)==len(set(parser.ids)), 'Hay identificadores HTML duplicados'
    for path in parser.paths:assert (root/path).is_file(),f'Falta recurso: {path}'
    assert hashlib.sha256((root/'js/excel_data.js').read_bytes()).hexdigest()=='19a88dd281e180667ac7ff2561b7d8b371b746e777002942053e11eee28a6a77','El motor original PBT.24 cambió'
    base=(root/'js/data.js').read_text(encoding='utf-8')
    constants={name:json.loads(re.search(r'const '+name+r'=(.*?);',base,re.S).group(1)) for name in ['PBT_MESES','PBT_SEMANAS','PBT_DATA']}
    combinations={(constants['PBT_SEMANAS'][row[3]],constants['PBT_MESES'][row[2]]) for row in constants['PBT_DATA']}
    assert all(week_info('2026'+str(week).zfill(2))['label'].startswith(month+' ') for week,month in combinations),'El calendario no coincide con los meses del PBT original'
    assert 'Number(x[1])+17' in html and 'Number(x[2])+1' in html,'Se alteró la transformación de coordenadas'
    originals=[('getPlay','cellPos','c12912e9eb450b68309b744105338c87726df1420c4ed4500d36c5153dae8b22'),('cellPos','block','8822912cb88f80d4fe88bcc262b867827ec741311475e9ffa278c2d0669eb04a'),('staticLayout','fallbackCoords','8c6d4812ec55501dacceb95110fb4e32aee316fa9a9491e0ebf065d14ab8b29b'),('layoutMarkers','renderLayout','934f88dc8f3ef9590ca200e78623af92dfc397af5a703f348449a78bcfdd2a9c'),('renderRoutines','setTotals','5b160b40b92010629c1013ebe70fb3c07711f75d172ebefb585fbff627769601')]
    for name,end,digest in originals:
        start=html.index('function '+name+'(')
        function=html[start:html.index('function '+end+'(',start)]
        assert hashlib.sha256(function.encode()).hexdigest()==digest,'Se alteró la función original '+name
    assert "filterHTML(tab,'semana'" not in html and "filterHTML(tab,'q'" not in html,'Hay filtros de periodo adicionales al mes'
    renderer=(root/'js/pdf-renderer.js').read_text(encoding='utf-8')
    assert 'PAGE=[612,792],MARGIN=36' in renderer,'Falta carta de 612 × 792 pt con márgenes de 36 pt'
    assert "['Fijo',31]" in renderer and 'tableHeader();' in renderer,'Falta estado Fijo o encabezado de rutinas'
    assert (root/'js/vendor/pdf-lib.min.js').is_file() and (root/'js/vendor/pdf-lib.LICENSE').is_file(),'Falta el exportador local o su licencia'
    assert 'multiple' not in re.search(r'<select id=".*?_manual_weekpart.*?</select>',(root/'js/weekly-ui.js').read_text(encoding='utf-8')).group(0),'Los días deben ser selección única'
    directory=read_compiled(root/'js/store-directory.js')
    assert 'aboutDialog' in parser.ids and 'aboutButton' in parser.ids,'Falta Acerca de'
    assert 'tabEquipo' not in parser.ids,'La navegación principal sólo debe mostrar Café y DT'
    assert 'Diseñado por Enrique' not in renderer,'La firma no debe imprimirse'
    assert 'window.PBT_DIRECTORY' not in renderer,'El exportador debe conservar su snapshot'
    pack=build(root/'data/motores')
    codes={row[0] for row in directory['stores']}
    assert all(code in codes for code,kind in pack['stores']),'Hay CeCo sin nombre en el directorio'
    expected=serialize(pack);assert (root/'data/motores/indice.json').read_text(encoding='utf-8')==expected,'Índice desactualizado'
    assert json.loads((root/'data/motores/manifest.json').read_text(encoding='utf-8'))==manifest_for(pack,expected),'Manifiesto desactualizado'
    assert len(expected.encode())<=64*1024*1024,'Divide el archivo histórico: el índice supera 64 MB'
    for path in [root/'sw.js',*list((root/'js').glob('*.js'))]:subprocess.run(['node','--check',str(path)],check=True,capture_output=True)
    # Inline scripts are still part of the original UI and must compile, too.
    for script in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',html,re.S):
        if script.strip():subprocess.run(['node','--check','-'],input=script,text=True,capture_output=True,check=True)
    workflow=(root/'.github/workflows/motores-semanales.yml').read_text(encoding='utf-8')
    actions=re.findall(r'uses:\s*(\S+)',workflow)
    assert actions and all(re.fullmatch(r'[^@]+@[a-f0-9]{40}',action) for action in actions),'Falta fijar acciones a SHA'
    assert 'scripts/validate_update.py --site _site' in workflow and 'needs: validar' in workflow,'La publicación debe depender de la revisión completa'
    assert 'js/motor-loader.js' in html,'Falta el verificador de integridad'
    return {'estado':'VERDE','version':'22','motores':len(pack['files']),'semanas':[w['id'] for w in pack['weeks']],'registros':sum(f['rows'] for f in pack['files']),'unidades':sum(f['units'] for f in pack['files']),'grupos':len(pack['rows']),'motor_original_sin_cambios':True,'calendario_original_445':True,'enlaces_locales':len(parser.paths),'formato_exportacion':'Carta vertical, margen 12.7 mm','indice_bytes':len(expected.encode()),'tiendas_directorio':len(directory['stores']),'cruces_CeCo_completos':True}

if __name__=='__main__':
    try:print(json.dumps(audit(),ensure_ascii=False,indent=2))
    except Exception as error:print(json.dumps({'estado':'ROJO','error':str(error)},ensure_ascii=False));raise SystemExit(1)
