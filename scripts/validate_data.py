#!/usr/bin/env python3
from __future__ import annotations

import json
import pathlib
import sys
from collections import Counter

ROOT = pathlib.Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "data" / "manifest.json"
OVERRIDES_PATH = ROOT / "data" / "overrides.json"

errors: list[str] = []
warnings: list[str] = []

def load_json(path: pathlib.Path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"invalid json {path.relative_to(ROOT)}: {exc}")
        return None

def as_rows(raw, key: str) -> list[dict]:
    if isinstance(raw, list):
        return raw
    if not isinstance(raw, dict):
        return []
    if isinstance(raw.get(key), list):
        return raw[key]
    if key == "buffs" and isinstance(raw.get("groups"), list):
        out: list[dict] = []
        for group in raw["groups"]:
            items = group.get("items") if isinstance(group, dict) else None
            if isinstance(items, list):
                for item in items:
                    out.append({**item, "kind": item.get("kind") or group.get("kind") or group.get("name")})
            elif isinstance(group, dict):
                out.append(group)
        return out
    arrays = [v for v in raw.values() if isinstance(v, list)]
    if len(arrays) == 1:
        return arrays[0]
    return [
        {"id": key_name, **value}
        for key_name, value in raw.items()
        if isinstance(value, dict)
    ]

def merge_overrides(base: list[dict], patches: list[dict] | None) -> list[dict]:
    rows = [dict(x) for x in base]
    for patch in patches or []:
        key = patch.get("id", patch.get("name"))
        index = next(
            (
                i for i, item in enumerate(rows)
                if item.get("id", item.get("name")) == key
            ),
            None,
        )
        if index is None:
            rows.append(dict(patch))
        else:
            rows[index] = {**rows[index], **patch}
    return rows

manifest = load_json(MANIFEST_PATH)
overrides = load_json(OVERRIDES_PATH)

if not isinstance(manifest, dict):
    errors.append("manifest must be an object")
    manifest = {}
if not isinstance(overrides, dict):
    errors.append("overrides must be an object")
    overrides = {}

catalog: dict[str, list[dict]] = {}

for key, rel in (manifest.get("datasets") or {}).items():
    path = ROOT / str(rel).removeprefix("./")
    if not path.exists():
        errors.append(f"missing {key}: {path.relative_to(ROOT)}")
        continue
    raw = load_json(path)
    rows = as_rows(raw, key)
    if not rows:
        errors.append(f"empty or unsupported dataset: {key}")
        continue
    merged = merge_overrides(rows, overrides.get(key))
    catalog[key] = merged

    keys = [item.get("id", item.get("name")) for item in merged]
    duplicates = [str(k) for k, n in Counter(keys).items() if k is not None and n > 1]
    if duplicates:
        errors.append(f"duplicate keys in {key}: {', '.join(duplicates[:10])}")

expected = manifest.get("expectedLiveCounts") or {}
for key, expected_count in expected.items():
    if key not in catalog:
        errors.append(f"expected count references missing dataset: {key}")
        continue
    actual = len(catalog[key])
    if actual != expected_count:
        errors.append(f"live count mismatch {key}: merged={actual}, expected={expected_count}")

# Asset path hygiene. Remote assets are allowed; local game assets must be root-relative.
for key, rows in catalog.items():
    for item in rows:
        asset = item.get("img") or item.get("avatar")
        if asset and not (str(asset).startswith("/") or str(asset).startswith("http://") or str(asset).startswith("https://")):
            errors.append(f"invalid asset path {key}/{item.get('id', item.get('name'))}: {asset}")

# Relationship integrity for composition data.
heroes = catalog.get("heroes", [])
equips = catalog.get("equips", [])
talents = catalog.get("talents", [])
comps = catalog.get("comps", [])

hero_names = {str(x.get("name")) for x in heroes if x.get("name")}
hero_ids = {str(x.get("id")) for x in heroes if x.get("id") is not None}
equip_ids = {str(x.get("id")) for x in equips if x.get("id") is not None}
talent_ids = {str(x.get("id")) for x in talents if x.get("id") is not None}

for comp in comps:
    label = comp.get("name") or comp.get("id") or "<unknown comp>"
    for name in [*(comp.get("heroes") or []), *(comp.get("core") or [])]:
        if str(name) not in hero_names:
            errors.append(f"comp {label}: unknown hero name {name}")

    for row in comp.get("board") or []:
        for hero_id in row or []:
            if hero_id is not None and str(hero_id) not in hero_ids:
                errors.append(f"comp {label}: unknown board hero id {hero_id}")

    for hero_id, ids in (comp.get("equips") or {}).items():
        if str(hero_id) not in hero_ids:
            errors.append(f"comp {label}: equipment assignment uses unknown hero id {hero_id}")
        for equip_id in ids or []:
            if str(equip_id) not in equip_ids:
                errors.append(f"comp {label}: unknown equip id {equip_id}")

    for hero_id, ids in (comp.get("talents") or {}).items():
        if str(hero_id) not in hero_ids:
            errors.append(f"comp {label}: talent assignment uses unknown hero id {hero_id}")
        for talent_id in ids or []:
            if str(talent_id) not in talent_ids:
                errors.append(f"comp {label}: unknown talent id {talent_id}")

if warnings:
    print("warnings:")
    for warning in warnings:
        print(f"- {warning}")

if errors:
    print("validation errors:", file=sys.stderr)
    for error in errors:
        print(f"- {error}", file=sys.stderr)
    sys.exit(1)

counts = ", ".join(f"{key}={len(rows)}" for key, rows in sorted(catalog.items()))
print(f"catalog validation passed: {counts}")
