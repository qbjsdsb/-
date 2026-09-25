#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = ROOT / "scripts" / "sync_data.py"

spec = importlib.util.spec_from_file_location("sync_data", MODULE_PATH)
if spec is None or spec.loader is None:
    raise RuntimeError("could not load sync_data.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

cases = [
    ("heroes", '<span>85<!-- --> / <!-- -->85</span>', 85, 85),
    ("equips", 'aspect-[1/1] <span>79<!-- --> / <!-- -->79</span>', 78, 79),
    ("talents", '<span>10 / 10</span><span>255<!-- --> / <!-- -->255</span>', 254, 255),
    ("players", '<p>21 位棋手：技能与专属牌</p>', 21, 21),
    ("effects", '<div>99 张效果牌</div>', 99, 99),
]

failures = []
for key, body, baseline, expected in cases:
    actual = module.parse_live_count(body, key, baseline)
    if actual != expected:
        failures.append(f"{key}: expected {expected}, got {actual}")

if not module.plausible(80, 79):
    failures.append("plausible rejected normal +1 update")
if module.plausible(500, 79):
    failures.append("plausible accepted suspicious jump")

if failures:
    print("\n".join(failures), file=sys.stderr)
    sys.exit(1)

print("sync probe parser tests passed")
