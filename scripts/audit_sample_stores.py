#!/usr/bin/env python3
"""Contrasta 10 tiendas reproducibles de la última semana con sus CSV originales."""
from __future__ import annotations
import argparse
from collections import defaultdict
from decimal import Decimal, ROUND_FLOOR
import json
from pathlib import Path
import random
import subprocess
try:
    from .build_weekly_motor import ROOT, csv_table, decode
    from .build_store_directory import read_compiled
except ImportError:
    from build_weekly_motor import ROOT, csv_table, decode
    from build_store_directory import read_compiled
import csv
import io


def audit(root=ROOT):
    pack=json.loads((root/'data/motores/indice.json').read_text(encoding='utf-8'))
    latest=max(file['week'] for file in pack['files'])
    meta=next(file for file in pack['files'] if file['week']==latest)
    table,_,delimiter,_=csv_table(decode((root/'data/motores'/meta['path']).read_bytes()))
    mix=['Espresso','COD','CBS','Food','Otro']; channels=['Lobby','Pick up & Delivery','DT']
    raw=defaultdict(lambda:[Decimal(0)]*9)
    def number(text):
        value=text.strip().replace(',','')
        return Decimal('-'+value[1:-1] if value.startswith('(') and value.endswith(')') else value or '0')
    for row in csv.DictReader(io.StringIO(table),delimiter=delimiter):
        row={k:str(v or '').strip() for k,v in row.items()}
        key=(row['Tiendas'],row['Clas_Semana'],row['DayPart']); value=number(row['Unidades'])
        bucket=raw[key];bucket[0]+=value;bucket[1+mix.index(row['Mix de Producto'])]+=value;bucket[6+channels.index(row['Distribucion Canal'])]+=value
    types=dict(pack['stores']);rng=random.Random(20261019)
    available={code for (code,_,_),totals in raw.items() if totals[0]>0}
    codes=[]
    for kind in ['CAFE','DT']:
        codes+=rng.sample(sorted(code for code in available if types[code]==kind),5)
    names={row[0]:row[1] for row in read_compiled(root/'js/store-directory.js')['stores']}
    cases=[]
    for code in codes:
        for day in ['Lun-Jue','Vie-Dom']:
            for part in ['1_Mañana','2_Intermedio','3_Tarde']:
                cases.append({'ceco':code,'name':names[code],'type':types[code],'day':day,'part':part,'filters':{'Tienda':['CeCo '+code],'Semana':[latest],'Weekpart':[{'Lun-Jue':'Weekday','Vie-Dom':'Weekend'}[day]],'DayPart':[{'1_Mañana':'Morning','2_Intermedio':'Lunch','3_Tarde':'Afternoon'}[part]]}})
    script="const fs=require('fs'),e=require('./js/weekly-core.js').engine(JSON.parse(fs.readFileSync('data/motores/indice.json')));const cases=JSON.parse(fs.readFileSync(0));process.stdout.write(JSON.stringify(cases.map(c=>e.calculate(c.filters,c.type))));"
    process=subprocess.run(['node','-e',script],input=json.dumps(cases),text=True,capture_output=True,check=True,cwd=root)
    outputs=json.loads(process.stdout)
    def percentages(values):
        total=sum(values)
        if total<=0 or any(v<0 for v in values):return None
        exact=[v*100/total for v in values]; whole=[int(v.to_integral_value(rounding=ROUND_FLOOR)) for v in exact]
        order=sorted(range(len(values)),key=lambda i:(-(exact[i]-whole[i]),i))
        for i in order[:100-sum(whole)]:whole[i]+=1
        return whole
    for case,actual in zip(cases,outputs):
        raw_values=raw[(case['ceco'],case['day'],case['part'])]
        assert Decimal(str(actual['unidades']))==raw_values[0],case
        assert list(actual['units']['mix'].values())==[float(v) for v in raw_values[1:6]],case
        assert list(actual['units']['channels'].values())==[float(v) for v in raw_values[6:9]],case
        expected_mix,expected_channels=percentages(raw_values[1:6]),percentages(raw_values[6:9])
        if expected_mix is not None and expected_channels is not None:
            assert list(actual['mix'].values())==expected_mix,case
            assert list(actual['canales'].values())==expected_channels,case
        else:assert not actual['valid'],case
        case.update(units=actual['unidades'],mix=actual['mix'],channels=actual['canales'],raw_mix=actual['units']['mix'],raw_channels=actual['units']['channels'],valid=actual['valid'],difference=0)
    return {'estado':'VERDE','semana':latest,'semilla':20261019,'tiendas':len(codes),'casos':len(cases),'diferencias':0,'selecciones':cases}


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--output',type=Path)
    args=parser.parse_args();result=audit();text=json.dumps(result,ensure_ascii=False,indent=2)+'\n'
    if args.output:args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(text,encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k!='selecciones'},ensure_ascii=False))
