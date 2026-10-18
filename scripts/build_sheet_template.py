#!/usr/bin/env python3
"""Extrae el acomodo y los fondos del Excel PBT, sin copiar sus cifras de ejemplo.

Uso: python scripts/build_sheet_template.py PBT.24Desbloqueado.xlsx [--check]
Sólo biblioteca estándar. El archivo fuente nunca se modifica.
"""
import argparse
import colorsys
import hashlib
import json
from pathlib import Path
import re
from xml.etree import ElementTree as ET
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
NS = {'s': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
      'a': 'http://schemas.openxmlformats.org/drawingml/2006/main'}
REL = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id'

def point(address):
    letters, row = re.fullmatch(r'([A-Z]+)(\d+)', address.replace('$', '')).groups()
    column = 0
    for letter in letters: column = column * 26 + ord(letter) - 64
    return int(row), column

def bounds(address):
    first, _, last = address.partition(':')
    r, c = point(first); rr, cc = point(last or first)
    return [r, c, rr-r+1, cc-c+1]

def extract(source):
    with ZipFile(source) as archive:
        xml = lambda name: ET.fromstring(archive.read(name))
        relationships = {item.attrib['Id']: item.attrib['Target'] for item in xml('xl/_rels/workbook.xml.rels')}
        sheets = {item.attrib['name']: relationships[item.attrib[REL]] for item in xml('xl/workbook.xml').find('s:sheets', NS)}
        styles = xml('xl/styles.xml'); xfs = list(styles.find('s:cellXfs', NS))
        fills = list(styles.find('s:fills', NS)); borders = list(styles.find('s:borders', NS))
        theme = xml('xl/theme/theme1.xml').find('a:themeElements/a:clrScheme', NS)
        palette = []
        for name in ['lt1','dk1','lt2','dk2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink']:
            item = list(theme.find('a:'+name, NS))[0]
            palette.append(item.attrib.get('lastClr', item.attrib.get('val')))
        def color(node):
            if node is None: return '#ffffff'
            base = node.attrib.get('rgb', palette[int(node.attrib.get('theme', 0))])[-6:]
            rgb = [int(base[i:i+2], 16)/255 for i in [0,2,4]]
            tint = float(node.attrib.get('tint', 0))
            if tint:
                h,l,s = colorsys.rgb_to_hls(*rgb); l = l*(1+tint) if tint<0 else l*(1-tint)+tint
                rgb = colorsys.hls_to_rgb(h,l,s)
            return '#' + ''.join(f'{round(v*255):02x}' for v in rgb)
        fill_colors = [color(item.find('s:patternFill/s:fgColor', NS)) for item in fills]
        result = {'source': Path(source).name, 'sha256': hashlib.sha256(Path(source).read_bytes()).hexdigest(),
                  'regions': {'period':'B7:E7','comments':'G7:O10','shift':'D12:E14','channels':'G12:I14','mix':'K12:O14'}}
        for key, name in [('cafe','Cafe Layout'),('dt','Drive Thru Layout')]:
            target=sheets[name]; sheet=xml(target.lstrip('/') if target.startswith('/') else 'xl/'+target)
            columns = [0]*14
            for item in sheet.findall('s:cols/s:col', NS):
                for col in range(max(2,int(item.attrib['min'])),min(15,int(item.attrib['max']))+1): columns[col-2]=float(item.attrib['width'])
            assert all(columns), 'Faltan anchos del plano original'
            result['columns']=columns
            merges=[item.attrib['ref'] for item in sheet.findall('s:mergeCells/s:mergeCell',NS)]
            assert all(value in merges for value in ['B7:E7','G7:O7','G8:O10','D12:E12','G12:I12','K12:O12'])
            cells=[];labels=[]
            # Café ends at row 24 in the supplied visual reference; DT uses all ten rows.
            last_row=24 if key=='cafe' else 27
            for cell in sheet.findall('s:sheetData/s:row/s:c',NS):
                row,col=point(cell.attrib['r'])
                if not (18<=row<=last_row and 2<=col<=15): continue
                xf=xfs[int(cell.attrib.get('s',0))]; border=borders[int(xf.attrib.get('borderId',0))]
                edges=''.join(side[0] for side in ['left','top','right','bottom'] if border.find('s:'+side,NS) is not None and border.find('s:'+side,NS).attrib.get('style'))
                cells.append([row,col,fill_colors[int(xf.attrib.get('fillId',0))],edges])
                formula=cell.find('s:f',NS); value=cell.find('s:v',NS)
                if formula is not None and 'Translation' in (formula.text or '') and value is not None:
                    address=cell.attrib['r']; text=value.text
                    spans={'cafe':{'E18':'D18:F18','J18':'I18:K18'},'dt':{'C22':'C21:C23','K21':'J21:L21'}}
                    region=spans[key].get(address,next((m for m in merges if m.split(':')[0]==address),address))
                    labels.append(bounds(region)+[text,'#ffffff' if text=='Café Filtrado' else '#171717'])
            result[key]={'sheet':name,'rows':last_row-17,'cells':cells,'labels':labels}
        return result

def serialize(data):
    return '/* Generated from PBT.24: layout only; all percentages come from CSV. */\n(function(root){const data='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';if(typeof module!=="undefined"&&module.exports)module.exports=data;else root.PBT_SHEET=data;})(typeof globalThis!=="undefined"?globalThis:this);\n'

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('source',type=Path);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    text=serialize(extract(args.source));output=ROOT/'js/sheet-template.js'
    if args.check:
        if output.read_text(encoding='utf-8')!=text:raise SystemExit('La plantilla no coincide con el Excel original.')
    else:output.write_text(text,encoding='utf-8')
    print(json.dumps({'estado':'VERDE','plantilla':'Café y DT','datos_de_venta_copiados':False},ensure_ascii=False))

if __name__=='__main__':main()
