#!/usr/bin/env python3
from __future__ import annotations
import json,pathlib,sys
ROOT=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((ROOT/"data/manifest.json").read_text(encoding="utf-8"))
errors=[]
for key,rel in manifest["datasets"].items():
    p=ROOT/rel.removeprefix("./")
    if not p.exists(): errors.append(f"missing {key}: {p}"); continue
    try: data=json.loads(p.read_text(encoding="utf-8"))
    except Exception as e: errors.append(f"invalid json {key}: {e}"); continue
    if not isinstance(data,(list,dict)) or len(data)==0: errors.append(f"empty {key}")
overrides=json.loads((ROOT/"data/overrides.json").read_text(encoding="utf-8"))
if not isinstance(overrides,dict): errors.append("overrides must be object")
if errors:
    print("\n".join(errors),file=sys.stderr);sys.exit(1)
print("catalog validation passed")
