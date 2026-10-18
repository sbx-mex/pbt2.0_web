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
    from .build_plan_catalog import check as check_plan_catalog
except ImportError:
    from build_weekly_motor import ROOT, build, serialize, week_info, manifest_for
    from build_store_directory import read_compiled
    from build_plan_catalog import check as check_plan_catalog

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
    # Calendario 4-4-5 verificado contra PBT; no requiere el cubo de venta retirado.
    ends=[4,8,13,17,21,26,30,34,39,43,47,53]
    months=['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
    expected_months=[month for month,start,end in zip(months,[0]+ends[:-1],ends) for _ in range(start+1,end+1)]
    assert all(week_info('2026'+str(week).zfill(2))['label'].startswith(month+' ') for week,month in enumerate(expected_months,1)),'Calendario 4-4-5 alterado'
    assert 'js/data.js' not in parser.paths and 'PBT_ENGINE' not in html,'La app sólo debe usar CSV para sus porcentajes'
    assert 'useOriginalMotor' not in html,'La fuente anterior ya no debe estar disponible'
    assert hashlib.sha256((root/'js/sheet-template.js').read_bytes()).hexdigest()=='6981029cf36b0ead69bb182f982b42bacfb43adfaa812f8878d23898fde5ffef','La plantilla extraída del Excel cambió'
    assert 'Number(x[1])+17' in html and 'Number(x[2])+1' in html,'Se alteró la transformación de coordenadas'
    # La búsqueda compacta conserva las 459,256 entradas del original (prueba exhaustiva en Node).
    catalog_bytes=check_plan_catalog(root)
    assert 'js/plan-catalog.js' in parser.paths and 'js/excel_data.js' not in parser.paths,'El arranque debe usar el catálogo compacto'
    assert "+'_zoom'" not in html,'Quedó una referencia al control eliminado que bloquea el plan'
    originals=[('cellPos','block','8822912cb88f80d4fe88bcc262b867827ec741311475e9ffa278c2d0669eb04a'),('layoutMarkers','renderLayout','934f88dc8f3ef9590ca200e78623af92dfc397af5a703f348449a78bcfdd2a9c'),('renderRoutines','setTotals','5b160b40b92010629c1013ebe70fb3c07711f75d172ebefb585fbff627769601')]
    for name,end,digest in originals:
        start=html.index('function '+name+'(')
        function=html[start:html.index('function '+end+'(',start)]
        assert hashlib.sha256(function.encode()).hexdigest()==digest,'Se alteró la función original '+name
    assert "filterHTML(tab,'semana'" not in html and "filterHTML(tab,'q'" not in html,'Hay filtros de periodo adicionales al mes'
    renderer=(root/'js/pdf-renderer.js').read_text(encoding='utf-8')
    assert 'PAGE=[612,792],MARGIN=36' in renderer,'Falta carta de 612 × 792 pt con márgenes de 36 pt'
    assert "['Fijo',38]" in renderer and 'tableHeader();' in renderer,'Falta estado Fijo o encabezado de rutinas'
    assert (root/'js/vendor/pdf-lib.min.js').is_file() and (root/'js/vendor/pdf-lib.LICENSE').is_file(),'Falta el exportador local o su licencia'
    assert 'multiple' not in re.search(r'<select id=".*?_manual_weekpart.*?</select>',(root/'js/weekly-ui.js').read_text(encoding='utf-8')).group(0),'Los días deben ser selección única'
    directory=read_compiled(root/'js/store-directory.js')
    assert 'aboutDialog' in parser.ids and 'aboutButton' in parser.ids,'Falta Acerca de'
    assert 'teamButton' in parser.ids and html.index('id="equipo"')<html.index('id="aboutDialog"'),'Equipo debe estar en la parte principal'
    assert 'drawText(CREDIT' not in renderer and 'Diseñado por' not in renderer,'El PDF debe omitir el pie de página'
    assert 'js/device-store.js' in parser.paths and 'js/device-ui.js' in parser.paths,'Falta el guardado por CeCo'
    assert 'padding-bottom:45.454545%' in (root/'css/styles.css').read_text(),'Falta altura compatible para el plano móvil'
    assert '#DistritoKike' not in html+(root/'js/app.js').read_text()+(root/'data/project.json').read_text(),'Firma obsoleta en la app'
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
    return {'estado':'VERDE','version':'26','motores':len(pack['files']),'semanas':[w['id'] for w in pack['weeks']],'registros':sum(f['rows'] for f in pack['files']),'unidades':sum(f['units'] for f in pack['files']),'grupos':len(pack['rows']),'motor_original_sin_cambios':True,'calendario_original_445':True,'enlaces_locales':len(parser.paths),'formato_exportacion':'Carta vertical, margen 12.7 mm','indice_bytes':len(expected.encode()),'catalogo_bytes':catalog_bytes,'tiendas_directorio':len(directory['stores']),'cruces_CeCo_completos':True}

if __name__=='__main__':
    try:print(json.dumps(audit(),ensure_ascii=False,indent=2))
    except Exception as error:print(json.dumps({'estado':'ROJO','error':str(error)},ensure_ascii=False));raise SystemExit(1)
