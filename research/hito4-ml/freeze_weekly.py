"""Freeze one prospective run before opening the reserved test in training."""
import argparse
import hashlib
import json
from pathlib import Path
import weekly_protocol as w
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--exports',type=Path,required=True)
parser.add_argument('--fit-cutoff',required=True)
parser.add_argument('--test-start',required=True)
parser.add_argument('--manifest',type=Path,required=True)
args=parser.parse_args()
packets=[json.loads(p.read_text(encoding='utf-8')) for p in sorted(args.exports.glob('*.json'))]
rows,excluded=w.build(packets,'training')
groups=w.split_rows(rows,args.fit_cutoff,args.test_start)
manifest=dict(version=w.VERSION,fit_cutoff=args.fit_cutoff,test_start=args.test_start,data_sha256=w.digest(rows),code_sha256=hashlib.sha256(Path(w.__file__).read_bytes()).hexdigest())
with args.manifest.open('x',encoding='utf-8') as handle:json.dump(manifest,handle,indent=2)
print(json.dumps(dict(people={k:len(v) for k,v in groups.items()},excluded=len(excluded),manifest=str(args.manifest),test_evaluated=False),indent=2))
