#!/usr/bin/env python3
"""Validate a prepared site's links, CSP, release URLs and compressed payloads."""
import ast
import gzip
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urlsplit,unquote


class Document(HTMLParser):
    def __init__(self):super().__init__();self.links=[];self.inline=[]
    def handle_starttag(self,tag,attrs):
        for name,value in attrs:
            if name.lower().startswith('on'):self.inline.append(name)
            if name in {'src','href'} and value and not value.startswith('#'):self.links.append(value)


def audit(site):
    site=Path(site)
    html=(site/'index.html').read_text(encoding='utf-8');doc=Document();doc.feed(html)
    assert not doc.inline,'Quedaron eventos ejecutables en el HTML.'
    assert "script-src 'self';" in html,'Falta la política de scripts locales.'
    assert not any(block.strip() for block in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',html,re.S)),'Quedó un script inline.'
    for name in ['ui.js','device-ui.js','weekly-ui.js']:
        assert not re.search(r'\bon(?:click|input|focus|change|keydown)=', (site/'js'/name).read_text(encoding='utf-8')),'Quedó un evento inline en '+name
    assert 'js/boot.js?' in html and 'id="bootError"' in html,'Falta recuperación de arranque.'
    worker=(site/'sw.js').read_text(encoding='utf-8')
    shell=ast.literal_eval(re.search(r'const SHELL_FILES=(\[.*?\]);',worker).group(1))
    plans=json.loads(re.search(r'const PLAN_FILES=(\{.*?\});',worker).group(1))
    for value in doc.links+shell+list(plans.values()):
        parsed=urlsplit(value)
        assert not parsed.scheme and not parsed.netloc,'El sitio depende de un recurso externo.'
        rel=unquote(parsed.path);path=site/rel
        if rel=='./':path=site/'index.html'
        assert path.resolve().is_relative_to(site.resolve()) and path.is_file(),'Recurso faltante: '+rel
    for part in ['plan','motores']:
        folder=site/'data'/part
        index=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))['index']
        raw=(folder/index['path']).read_bytes();zipped=(folder/index['gzip']['path']).read_bytes()
        assert len(raw)==index['bytes'] and hashlib.sha256(raw).hexdigest()==index['sha256'],'Índice no coincide.'
        assert len(zipped)==index['gzip']['bytes'] and hashlib.sha256(zipped).hexdigest()==index['gzip']['sha256'],'Comprimido no coincide.'
        assert gzip.decompress(zipped)==raw,'La compresión alteró los datos.'
    for obsolete in ['js/data.js','js/excel_data.js','js/plan-catalog.js']:
        assert not (site/obsolete).exists(),'Quedó un motor obsoleto en el sitio.'
    return {'estado':'VERDE','recursos_comprobados':len(doc.links+shell),'csp_scripts_locales':True,'gzip_sin_perdida':True}
