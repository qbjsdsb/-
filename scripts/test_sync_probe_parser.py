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

card_html = """
<details><summary>英雄<!-- -->索引（<!-- -->85<!-- -->）</summary></details>
<details><summary>装备<!-- -->索引（<!-- -->79<!-- -->）</summary></details>
<details><summary>天赋<!-- -->索引（<!-- -->255<!-- -->）</summary></details>
<details><summary>效果牌<!-- -->索引（<!-- -->99<!-- -->）</summary></details>
"""
expected = {"heroes": 85, "equips": 79, "talents": 255, "effects": 99}
actual = module.parse_card_index_counts(card_html)

failures = []
if actual != expected:
    failures.append(f"card index parser expected {expected}, got {actual}")

player_cases = [
    ('<p>21 位棋手：技能与专属牌</p>', 21),
    ('<span>21 / 21</span>', 21),
]
for body, wanted in player_cases:
    got = module.parse_player_count(body)
    if got != wanted:
        failures.append(f"player parser expected {wanted}, got {got}")

if not module.plausible(80, 79):
    failures.append("plausible rejected normal +1 update")
if module.plausible(500, 79):
    failures.append("plausible accepted suspicious jump")

if failures:
    print("\n".join(failures), file=sys.stderr)
    sys.exit(1)

print("sync probe parser tests passed")
