#!/usr/bin/env python3
"""Synchronize structured snapshots and probe the live WXQ reference site.

The automation keeps three layers separate:
- data/catalog/* mirrors the reusable structured upstream repository.
- expectedLiveCounts records what the live reference currently exposes.
- data/overrides.json contains human-verified fixes and is never overwritten.

A live probe failure or suspicious value preserves the last known reference.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import pathlib
import re
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "catalog"
MANIFEST = ROOT / "data" / "manifest.json"
UPSTREAM = "https://raw.githubusercontent.com/the-beating-light-of-the-nail/wanxiang-qipu/master/data"
FILES = ["heroes", "players", "equips", "talents", "effects", "comps", "buffs", "tips", "news", "camps"]

LIVE_PROBES = {
    "heroes": "https://wxq.whatsyour.fun/cards?type=hero",
    "players": "https://wxq.whatsyour.fun/players",
    "equips": "https://wxq.whatsyour.fun/cards?type=equip",
    "talents": "https://wxq.whatsyour.fun/cards?type=talent",
    "effects": "https://wxq.whatsyour.fun/cards?type=effect",
}

def fetch_text(url: str, timeout: int = 25) -> str:
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "wanxiang-atlas-sync/3",
            "Accept": "text/html,application/json,text/plain;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")

def parse_live_count(body: str, key: str, baseline: int | None = None) -> int | None:
    # React SSR may split text as 79<!-- --> / <!-- -->79.
    clean = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    candidates: list[int] = []
    for left, right in re.findall(r"(?<!\d)(\d{1,4})\s*/\s*(\d{1,4})(?!\d)", clean):
        if left == right:
            value = int(left)
            if 10 <= value <= 2000:
                candidates.append(value)

    if candidates:
        if baseline:
            # Prefer the value closest to the last trusted observation.
            return min(candidates, key=lambda value: abs(value - baseline))
        return candidates[0]

    # Fallback to visible text if the compact counter markup changes.
    visible = html.unescape(re.sub(r"<[^>]+>", " ", clean))
    visible = re.sub(r"\s+", " ", visible)
    patterns = {
        "players": [r"(\d{1,3})\s*位棋手"],
        "heroes": [r"(\d{1,3})\s*(?:名)?英雄"],
        "equips": [r"(\d{1,3})\s*(?:件)?装备"],
        "talents": [r"(\d{1,4})\s*(?:张)?天赋"],
        "effects": [r"(\d{1,3})\s*(?:张)?效果牌"],
    }
    for pattern in patterns.get(key, []):
        match = re.search(pattern, visible)
        if match:
            value = int(match.group(1))
            if 10 <= value <= 2000:
                return value
    return None

def plausible(value: int, baseline: int | None) -> bool:
    if baseline is None or baseline <= 0:
        return True
    # Game catalogs should not halve or more-than-double in one unattended sync.
    return value >= max(10, baseline // 2) and value <= baseline * 2 + 20

def probe_live_counts(existing: dict[str, int]) -> tuple[dict[str, int], list[str]]:
    counts = dict(existing)
    successes: list[str] = []
    for key, url in LIVE_PROBES.items():
        baseline = existing.get(key)
        try:
            body = fetch_text(url, timeout=20)
            count = parse_live_count(body, key, baseline)
            if count is None:
                print(f"warning: could not parse live count for {key}")
                continue
            if not plausible(count, baseline):
                print(f"warning: ignored suspicious live count for {key}: {count} (baseline={baseline})")
                continue
            counts[key] = count
            successes.append(key)
            print(f"live probe {key}={count}")
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            print(f"warning: live probe failed for {key}: {exc}")
    return counts, successes

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

    # Avoid a daily no-op commit. Dates change only when the live reference itself changes.
    if live_successes:
        manifest["liveProbeCoverage"] = sorted(live_successes)
    if live_counts != existing_live:
        manifest["liveReferenceDate"] = dt.datetime.now(dt.timezone.utc).date().isoformat()

    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("snapshot counts", snapshot_counts)
    print("live counts", live_counts)

if __name__ == "__main__":
    main()
