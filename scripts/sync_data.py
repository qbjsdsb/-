#!/usr/bin/env python3
"""Synchronize catalog snapshots and probe the live WXQ reference site.

Automation is intentionally split into two sources of truth:
- data/catalog/* mirrors the reusable structured upstream repository.
- expectedLiveCounts records what the live reference site currently exposes.
- data/overrides.json is human-verified and is never overwritten here.

A live probe failure must never erase the last known live reference.
"""
from __future__ import annotations

import datetime as dt
import json
import pathlib
import re
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "catalog"
MANIFEST = ROOT / "data" / "manifest.json"
UPSTREAM = "https://raw.githubusercontent.com/the-beating-light-of-the-nail/wanxiang-qipu/master/data"
FILES = ["heroes","players","equips","talents","effects","comps","buffs","tips","news","camps"]

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
            "User-Agent": "wanxiang-atlas-sync/2",
            "Accept": "text/html,application/json,text/plain;q=0.9,*/*;q=0.8",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")

def parse_live_count(body: str, key: str) -> int | None:
    # Cards pages and the player index expose compact N / N counters.
    for left, right in re.findall(r"(?<!\\d)(\\d{1,4})\\s*/\\s*(\\d{1,4})(?!\\d)", body):
        if left == right:
            value = int(left)
            if value > 0:
                return value

    patterns = {
        "players": [r"(\\d{1,3})\\s*位棋手"],
        "heroes": [r"(\\d{1,3})\\s*(?:名)?英雄"],
        "equips": [r"(\\d{1,3})\\s*(?:件)?装备"],
        "talents": [r"(\\d{1,4})\\s*(?:张)?天赋"],
        "effects": [r"(\\d{1,3})\\s*(?:张)?效果牌"],
    }
    for pattern in patterns.get(key, []):
        match = re.search(pattern, clean)
        if match:
            value = int(match.group(1))
            if value > 0:
                return value
    return None

def probe_live_counts(existing: dict[str, int]) -> tuple[dict[str, int], list[str]]:
    counts = dict(existing)
    successes: list[str] = []
    for key, url in LIVE_PROBES.items():
        try:
            body = fetch_text(url, timeout=20)
            count = parse_live_count(body, key)
            if count is None:
                print(f"warning: could not parse live count for {key}")
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
            json.dumps(parsed, ensure_ascii=False, indent=2) + "\\n",
            encoding="utf-8",
        )
        snapshot_counts[name] = len(parsed) if isinstance(parsed, list) else None

    readme = fetch_text(f"{UPSTREAM}/README.md")
    snapshot_date = re.search(r"整理时间\\s*\\*\\*(\\d{4}-\\d{2}-\\d{2})\\*\\*", readme)

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if snapshot_date:
        manifest["catalogSnapshotDate"] = snapshot_date.group(1)

    existing_live = manifest.get("expectedLiveCounts") or {}
    live_counts, live_successes = probe_live_counts(existing_live)
    manifest["expectedLiveCounts"] = live_counts

    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0)
    manifest["lastUpstreamSyncAt"] = now.isoformat()
    manifest["snapshotCounts"] = snapshot_counts
    manifest["lastLiveProbeAt"] = now.isoformat()

    if live_successes:
        manifest["liveReferenceDate"] = now.date().isoformat()
        manifest["liveProbeCoverage"] = sorted(live_successes)

    MANIFEST.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\\n",
        encoding="utf-8",
    )
    print("snapshot counts", snapshot_counts)
    print("live counts", live_counts)

if __name__ == "__main__":
    main()
