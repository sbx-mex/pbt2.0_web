#!/usr/bin/env python3
"""Conciliación independiente: CSV crudo -> filtros -> unidades -> porcentajes web.
No modifica CSV ni Excel. Usa sólo Python estándar y Node.
"""
from collections import defaultdict
import csv
from decimal import Decimal
import io
import itertools
import json
from pathlib import Path
import subprocess
try:
    from .build_weekly_motor import ROOT, decode, number, week_info
except ImportError:
    from build_weekly_motor import ROOT, decode, number, week_info

MIX=['Espresso','COD','CBS','Food','Otro']
CHANNEL=['Lobby','Pick up & Delivery','DT']
DAYS={'Lun-Jue':'Weekday','Vie-Dom':'Weekend'}
PARTS={'1_Mañana':'Morning','2_Intermedio':'Lunch','3_Tarde':'Afternoon'}

def audit(root=ROOT):
    pack=json.loads((root/'data/motores/indice.json').read_text())
    stores=dict(pack['stores']);raw=defaultdict(lambda:[Decimal(0)]*18);dt=set();row_count=0
    for meta in pack['files']:
        text=decode((root/'data/motores'/meta['path']).read_bytes());lines=text.splitlines()
        for offset,line in enumerate(lines[:100]):
            for delimiter in [',',';','\t']:
                fields=next(csv.reader([line],delimiter=delimiter))
                if 'Unidades' in fields and 'Tiendas' in fields:break
            else:continue
            break
        for source in csv.DictReader(io.StringIO('\n'.join(lines[offset:])),delimiter=delimiter):
            r={k:str(v or '').strip() for k,v in source.items()};amount=number(r['Unidades']);aa=number(r.get('Unidades AA',''))
            code=r['Tiendas'];key=(code,week_info(r['Semana'])['label'],DAYS[r['Clas_Semana']],PARTS[r['DayPart']]);target=raw[key]
            for start,value in [(0,amount),(9,aa)]:
                target[start]+=value;target[start+1+MIX.index(r['Mix de Producto'])]+=value;target[start+6+CHANNEL.index(r['Distribucion Canal'])]+=value
            if r['Distribucion Canal']=='DT' and (amount or aa):dt.add(code)
            row_count+=1
    assert all((kind=='DT')==(code in dt) for code,kind in stores.items()),'Clasificación DT distinta del CSV'
    assert row_count==sum(f['rows'] for f in pack['files'])
    months=list(dict.fromkeys(w['label'] for w in pack['weeks']));month_sets=[[],*[[m] for m in months]]
    if len(months)>1:month_sets.append(months[:2])
    cases=[]
    for kind in ['CAFE','DT']:
        codes=[code for code,t in pack['stores'] if t==kind]
        # Deterministic spread across the entire catalog, plus both ends.
        selected=list(dict.fromkeys(codes[::max(1,len(codes)//24)]+codes[-1:]))
        for months_filter,days,part,code in itertools.product(month_sets,['Weekday','Weekend'],['Morning','Lunch','Afternoon'],[None,*selected]):
            cases.append({'type':kind,'filters':{'Mes':months_filter,'Weekpart':[days],'DayPart':[part],'Tienda':['CeCo '+code] if code else []}})
    js="""const fs=require('fs'),core=require('./js/weekly-core.js');const input=JSON.parse(fs.readFileSync(0,'utf8')),e=core.engine(input.pack);process.stdout.write(JSON.stringify(input.cases.map(c=>e.calculate(c.filters,c.type))));"""
    result=subprocess.run(['node','-e',js],input=json.dumps({'pack':pack,'cases':cases}),text=True,capture_output=True,check=True,cwd=root)
    calculated=json.loads(result.stdout);valid=0;invalid=0
    for case,actual in zip(cases,calculated):
        f=case['filters'];expected=[Decimal(0)]*18
        for (code,month,days,part),values in raw.items():
            if stores[code]!=case['type'] or (f['Mes'] and month not in f['Mes']) or days!=f['Weekpart'][0] or part!=f['DayPart'][0] or (f['Tienda'] and 'CeCo '+code not in f['Tienda']):continue
            expected=[a+b for a,b in zip(expected,values)]
        assert abs(float(expected[0])-actual['unidades'])<1e-6,case
        aa_known=all(file['hasAA'] for file in pack['files'] if not f['Mes'] or week_info(file['week'])['label'] in f['Mes'])
        if actual['registros'] and aa_known:assert abs(float(expected[9])-actual['unidadesAA'])<1e-6,case
        for offset,key,labels,names in [(1,'mix',MIX,['Espresso','Café filtrado','CBS','Food','Otro']),(6,'channels',CHANNEL,CHANNEL)]:
            for index,name in enumerate(names):assert abs(actual['units'][key][name]-float(expected[offset+index]))<1e-6,case
            if actual['valid']:
                displayed=actual['mix'] if key=='mix' else actual['canales']
                assert sum(round(value*10) for value in displayed.values())==1000,case
                for index,name in enumerate(names):
                    exact=float(expected[offset+index]/expected[0]*100)
                    assert abs(displayed[name]-exact)<.1000001,(case,name,displayed[name],exact)
            else:assert all(value is None for value in (actual['mix'] if key=='mix' else actual['canales']).values()),case
        valid+=int(actual['valid']);invalid+=int(not actual['valid'])
    return {'estado':'VERDE','csv':len(pack['files']),'registros_csv':row_count,'casos_filtrados':len(cases),'selecciones_validas':valid,'selecciones_sin_base_positiva':invalid,'tiendas_DT_con_evidencia':len(dt),'unidades_actuales':sum(f['units'] for f in pack['files']),'unidades_AA':sum(f['unitsAA'] for f in pack['files']),'porcentajes_por_unidades':True,'cierre_a_100_con_decimas':True,'desviacion_redondeo_menor_a_0_1_puntos':True}

if __name__=='__main__':
    try:print(json.dumps(audit(),ensure_ascii=False,indent=2))
    except Exception as error:print(json.dumps({'estado':'ROJO','error':str(error)},ensure_ascii=False));raise SystemExit(1)
