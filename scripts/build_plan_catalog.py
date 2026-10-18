#!/usr/bin/env python3
"""Compacta las búsquedas de PBT.24 sin cambiar candidatos, rutinas ni coordenadas."""
from __future__ import annotations
import argparse
import hashlib
import itertools
import json
from pathlib import Path
try:
    from .build_weekly_motor import atomic_write
except ImportError:
    from build_weekly_motor import atomic_write

ROOT = Path(__file__).resolve().parents[1]
SOURCE_SHA = '19a88dd281e180667ac7ff2561b7d8b371b746e777002942053e11eee28a6a77'

RUNTIME = r'''
 const candidateMaps={}, tables={cafe:{},dt:{}};
 data.lookupPlay=function(tab,partners,nearest){
  const candidates=data[tab+'Candidates'],runs=data.playRuns[tab]?.[partners];
  if(!candidates||!runs)return undefined;
  if(!candidateMaps[tab])candidateMaps[tab]=new Map(candidates.map((value,index)=>[value,index]));
  const index=candidateMaps[tab].get(nearest);if(index===undefined)return undefined;
  if(!tables[tab][partners]){
   const values=new Uint16Array(candidates.length);let offset=0;
   for(const [length,play] of runs){values.fill(play,offset,offset+length);offset+=length;}
   tables[tab][partners]=values;
  }
  return data.playIds[tables[tab][partners][index]];
 };
 return data;
})();
if(typeof module!=='undefined'&&module.exports)module.exports=EXCEL_DATA;
'''

def compiled(root=ROOT):
    source=(root/'js/excel_data.js').read_bytes()
    if hashlib.sha256(source).hexdigest()!=SOURCE_SHA:
        raise ValueError('El original PBT.24 cambió; revisa su fidelidad antes de compactarlo.')
    text=source.decode('utf-8')
    original=json.loads(text[text.index('{'):].rstrip().rstrip(';'))
    ids=sorted(original['routines'])
    if len(ids)>=65536:raise ValueError('El catálogo supera el límite de planes.')
    codes={play:index for index,play in enumerate(ids)}
    data={name:original[name] for name in ['cafeCandidates','dtCandidates','routines','coords','channelProd']}
    data['playIds']=ids;data['playRuns']={}
    for tab in ['cafe','dt']:
        candidates=original[tab+'Candidates']
        positions={','.join(map(str,row)):index for index,row in enumerate(candidates)}
        if len(positions)!=len(candidates):raise ValueError('Candidatos duplicados.')
        matrix={};seen=set()
        for key,play in original[tab+'PlayEntries']:
            if key in seen:raise ValueError('Búsqueda duplicada: '+key)
            seen.add(key);partners,vector=key.split(',',1)
            if partners not in matrix:matrix[partners]=[-1]*len(candidates)
            matrix[partners][positions[vector]]=codes[play]
        if any(-1 in row for row in matrix.values()):raise ValueError('Falta una combinación del original.')
        data['playRuns'][tab]={partners:[[len(list(group)),value] for value,group in itertools.groupby(row)] for partners,row in matrix.items()}
    payload=json.dumps(data,ensure_ascii=False,separators=(',',':'),allow_nan=False)
    return ('/* Generado desde PBT.24. No editar a mano. */\nvar EXCEL_DATA=(function(){\n const data='+payload+';\n'+RUNTIME)

def check(root=ROOT):
    expected=compiled(root)
    if (root/'js/plan-catalog.js').read_text(encoding='utf-8')!=expected:
        raise ValueError('Catálogo compacto desactualizado: ejecuta scripts/build_plan_catalog.py.')
    return len(expected.encode('utf-8'))

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--check',action='store_true');args=parser.parse_args()
    if args.check:size=check()
    else:
        text=compiled();atomic_write(ROOT/'js/plan-catalog.js',text);size=len(text.encode('utf-8'))
    print(json.dumps({'estado':'VERDE','catalogo_bytes':size,'original_bytes':(ROOT/'js/excel_data.js').stat().st_size,'combinaciones':459256}))
