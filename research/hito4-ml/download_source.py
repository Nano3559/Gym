"""Fetch the public original, without credentials, and record its provenance. Never trains."""
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import urllib.request

SOURCE='https://osf.io/ztysq/download'
REQUIRED={'study_id','time','weight_gcrc','cal','par_kcal_kg_day'}


def fetch_source(destination,opener=urllib.request.urlopen):
    root=Path(destination).resolve()
    root.mkdir(parents=True,exist_ok=True)
    original=root/'All_outcomes_v4.csv'
    metadata=root/'provenance.json'
    if original.exists() or metadata.exists():
        raise ValueError('La fuente original o su procedencia ya existen. No se sobrescriben.')
    request=urllib.request.Request(SOURCE,headers={'User-Agent':'Gym-Hito4-Research/1.0'})
    with opener(request,timeout=20) as response:
        content=response.read(50_000_001)
        if len(content)>50_000_000:
            raise ValueError('La descarga supera 50 MB.')
        headers=next(csv.reader(content.decode('utf-8-sig').splitlines()),[])
        if len(headers)!=len(set(headers)) or not REQUIRED.issubset(set(headers)):
            raise ValueError('La respuesta no tiene el encabezado esperado del CSV; no se guarda como DIETFITS.')
        provenance={'source_url':SOURCE,'final_url':response.geturl(),'retrieved_at':datetime.now(timezone.utc).isoformat(),
                    'sha256':hashlib.sha256(content).hexdigest(),'bytes':len(content),'authentication_used':False,
                    'license_verified':False,'training_executed':False}
    with original.open('xb') as stream:
        stream.write(content)
    with metadata.open('x',encoding='utf-8') as stream:
        json.dump(provenance,stream,indent=2)
    return provenance


if __name__=='__main__':
    parser=argparse.ArgumentParser(description='Descargar y preservar el original público de DIETFITS; no entrena.')
    parser.add_argument('--out',type=Path,default=Path('data/raw'))
    args=parser.parse_args()
    print(json.dumps(fetch_source(args.out),indent=2))
