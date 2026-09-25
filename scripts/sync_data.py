#!/usr/bin/env python3
"""Sync public WXQ catalog snapshots into this repository.

Only data/catalog and sync metadata are automated. Manual corrections live in
data/overrides.json and are intentionally never overwritten.
"""
from __future__ import annotations
import datetime as dt, json, pathlib, re, urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "catalog"
MANIFEST = ROOT / "data" / "manifest.json"
UPSTREAM = "https://raw.githubusercontent.com/the-beating-light-of-the-nail/wanxiang-qipu/master/data"
FILES = ["heroes","players","equips","talents","effects","comps","buffs","tips","news","camps"]

def fetch_text(url: str) -> str:
    req=urllib.request.Request(url,headers={"User-Agent":"wanxiang-atlas-sync/1"})
    with urllib.request.urlopen(req,timeout=25) as r:
        return r.read().decode("utf-8")

def main() -> None:
    CATALOG.mkdir(parents=True,exist_ok=True)
    counts={}
    for name in FILES:
        raw=fetch_text(f"{UPSTREAM}/{name}.json")
        parsed=json.loads(raw)
        (CATALOG/f"{name}.json").write_text(json.dumps(parsed,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
        counts[name]=len(parsed) if isinstance(parsed,list) else None

    readme=fetch_text(f"{UPSTREAM}/README.md")
    m=re.search(r"整理时间\s*\*\*(\d{4}-\d{2}-\d{2})\*\*",readme)
    manifest=json.loads(MANIFEST.read_text(encoding="utf-8"))
    if m: manifest["catalogSnapshotDate"]=m.group(1)
    manifest["lastUpstreamSyncAt"]=dt.datetime.now(dt.timezone.utc).replace(microsecond=0).isoformat()
    manifest["snapshotCounts"]=counts
    MANIFEST.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("synced",counts)

if __name__=="__main__": main()
