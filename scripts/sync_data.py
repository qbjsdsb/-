#!/usr/bin/env python3
"""Synchronize structured snapshots and probe the live WXQ reference site.

Data layers:
- data/catalog/* mirrors the reusable structured upstream repository.
- expectedLiveCounts records what the live reference currently exposes.
- data/overrides.json contains human-verified fixes and is never overwritten.

Card counts come from the labelled indexes on /cards so client-side query
parameters cannot make one card type masquerade as another.
"""
from __future__ import annotations

import html
import json
import pathlib
import re
import urllib.error
import urllib.request
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "catalog"
MANIFEST = ROOT / "data" / "manifest.json"
UPSTREAM = "https://raw.githubusercontent.com/the-beating-light-of-the-nail/wanxiang-qipu/master/data"
FILES = ["heroes", "players", "equips", "talents", "effects", "comps", "buffs", "tips", "news", "camps"]
CARDS_INDEX_URL = "https://wxq.whatsyour.fun/cards"
PLAYERS_URL = "https://wxq.whatsyour.fun/players"
TAIPEI = ZoneInfo("Asia/Taipei")

CARD_INDEX_LABELS = {
    "heroes": "英雄",
    "equips": "装备",
    "talents": "天赋",
    "effects": "效果牌",
}

def fetch_text(url: str, timeout: int = 25) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "wanxiang-atlas-sync/4",
            "Accept": "text/html,application/json,text/plain;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")

def visible_text(body: str) -> str:
    clean = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    clean = html.unescape(re.sub(r"<[^>]+>", " ", clean))
    return re.sub(r"\s+", " ", clean)

def parse_card_index_counts(body: str) -> dict[str, int]:
    clean = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    found: dict[str, int] = {}
    for key, label in CARD_INDEX_LABELS.items():
        # Current SSR shape becomes e.g. 装备索引（79） after comments are removed.
        pattern = rf"{re.escape(label)}\s*索引[（(]\s*(\d{{1,4}})\s*[）)]"
        match = re.search(pattern, clean)
        if match:
            value = int(match.group(1))
            if 10 <= value <= 2000:
                found[key] = value
    return found

def parse_player_count(body: str) -> int | None:
    text = visible_text(body)
    match = re.search(r"(\d{1,3})\s*位棋手", text)
    if match:
        value = int(match.group(1))
        if 10 <= value <= 500:
            return value
    for left, right in re.findall(r"(?<!\d)(\d{1,3})\s*/\s*(\d{1,3})(?!\d)", text):
        if left == right and 10 <= int(left) <= 500:
            return int(left)
    return None

def plausible(value: int, baseline: int | None) -> bool:
    if baseline is None or baseline <= 0:
        return True
    return value >= max(10, baseline // 2) and value <= baseline * 2 + 20

def probe_live_counts(existing: dict[str, int]) -> tuple[dict[str, int], list[str]]:
    counts = dict(existing)
    successes: list[str] = []

    try:
        card_body = fetch_text(CARDS_INDEX_URL, timeout=20)
        card_counts = parse_card_index_counts(card_body)
        for key in CARD_INDEX_LABELS:
            value = card_counts.get(key)
            baseline = existing.get(key)
            if value is None:
                print(f"warning: labelled live index missing for {key}")
                continue
            if not plausible(value, baseline):
                print(f"warning: ignored suspicious live count for {key}: {value} (baseline={baseline})")
                continue
            counts[key] = value
            successes.append(key)
            print(f"live probe {key}={value}")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"warning: live cards probe failed: {exc}")

    try:
        player_body = fetch_text(PLAYERS_URL, timeout=20)
        value = parse_player_count(player_body)
        baseline = existing.get("players")
        if value is None:
            print("warning: could not parse live count for players")
        elif not plausible(value, baseline):
            print(f"warning: ignored suspicious live count for players: {value} (baseline={baseline})")
        else:
            counts["players"] = value
            successes.append("players")
            print(f"live probe players={value}")
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"warning: live players probe failed: {exc}")

    return counts, sorted(set(successes))

def main() -> None:
    CATALOG.mkdir(parents=True, exist_ok=True)
    snapshot_counts: dict[str, int | None] = {}

    for name in FILES:
        raw = fetch_text(f"{UPSTREAM}/{name}.json")
        parsed = json.loads(raw)
        (CATALOG / f"{name}.json").write_text(
            json.dumps(parsed, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        snapshot_counts[name] = len(parsed) if isinstance(parsed, list) else None

    readme = fetch_text(f"{UPSTREAM}/README.md")
    snapshot_date = re.search(r"整理时间\s*\*\*(\d{4}-\d{2}-\d{2})\*\*", readme)

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if snapshot_date:
        manifest["catalogSnapshotDate"] = snapshot_date.group(1)

    existing_live = manifest.get("expectedLiveCounts") or {}
    live_counts, live_successes = probe_live_counts(existing_live)
    manifest["expectedLiveCounts"] = live_counts
    manifest["snapshotCounts"] = snapshot_counts

    if live_successes:
        manifest["liveProbeCoverage"] = live_successes
    if live_counts != existing_live:
        manifest["liveReferenceDate"] = datetime.now(TAIPEI).date().isoformat()

    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("snapshot counts", snapshot_counts)
    print("live counts", live_counts)

if __name__ == "__main__":
    main()
