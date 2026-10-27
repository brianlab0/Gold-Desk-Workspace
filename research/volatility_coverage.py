"""Rolling out-of-sample check of the historical adverse-move range.

For every test day, the p95 is computed ONLY from the preceding N trading days,
then we count how often windows that START on the test day exceed it. A stable
95% range should be exceeded about 5% of the time. Large or one-sided misses
mean the range is not a reliable description of the next day.

Needs: pip install yfinance. Prints results; use --write to save a markdown report.
Source caveat: Yahoo GC=F is COMEX futures, about 60 days of 5-minute history only.
"""
from __future__ import annotations

import argparse
import statistics
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'scripts'))
from backend.volatility import HORIZON_BARS, adverse_moves, percentile  # noqa: E402
from build_volatility_snapshot import MIN_BARS_PER_DAY, load_bars  # noqa: E402

WINDOWS = (5, 10, 20)
LEVEL = 95


def by_day(bars):
    days: dict[str, list[dict]] = {}
    for b in bars:
        days.setdefault(datetime.fromtimestamp(b['time'], timezone.utc).date().isoformat(), []).append(b)
    return {d: v for d, v in sorted(days.items()) if len(v) >= MIN_BARS_PER_DAY}


def moves_starting_on(day_bars, context_bars, side, n):
    """Adverse moves for windows whose START bar is in `day_bars`; needs bars after the day too."""
    start_times = {b['time'] for b in day_bars}
    allb = sorted(context_bars, key=lambda b: b['time'])
    out = []
    # reuse the library on the combined series, then keep windows that start on the test day
    full = adverse_moves(allb, side, n)
    idx = 0
    for i in range(len(allb) - n):
        if allb[i + n]['time'] - allb[i]['time'] != n * 300:
            continue
        if allb[i]['time'] in start_times:
            out.append(full[idx])
        idx += 1
    return out


def run(bars):
    days = by_day(bars)
    keys = list(days)
    results = {}
    for side in ('BUY', 'SELL'):
        for h, n in HORIZON_BARS.items():
            for w in WINDOWS:
                rates, tested = [], 0
                for t in range(w, len(keys)):
                    train = [b for k in keys[t - w:t] for b in days[k]]
                    train_moves = adverse_moves(train, side, n)
                    if len(train_moves) < 200:
                        continue
                    cut = percentile(train_moves, LEVEL)
                    nxt = keys[t + 1] if t + 1 < len(keys) else None
                    context = days[keys[t]] + (days[nxt] if nxt else [])
                    test = moves_starting_on(days[keys[t]], context, side, n)
                    if len(test) < 50:
                        continue
                    rates.append(sum(1 for m in test if m > cut) / len(test) * 100)
                    tested += 1
                if rates:
                    results[(side, h, w)] = dict(
                        days=tested, mean=statistics.mean(rates), median=statistics.median(rates),
                        pct_days_over_10=sum(1 for r in rates if r > 10) / len(rates) * 100,
                        pct_days_zero=sum(1 for r in rates if r == 0) / len(rates) * 100)
    return results, len(keys)


def report(results, ndays) -> str:
    lines = [f'# 波動範圍滾動驗證（{LEVEL}% 範圍）', '',
             f'資料：Yahoo Finance GC=F（COMEX 黃金期貨）5 分鐘，共 {ndays} 個有效交易日。',
             '做法：每個測試日只用「之前 N 個交易日」算 95% 不利變動，再看當天起算的視窗有多少比例超過它。穩定時應接近 5%。', '',
             '| 方向 | 持有 | 參考天數 N | 測試日數 | 平均超過率 % | 中位數 % | 超過率>10% 的日子占比 % | 完全沒超過的日子占比 % |',
             '|---|---|---|---|---|---|---|---|']
    for (side, h, w), r in sorted(results.items()):
        lines.append(f'| {side} | {h} | {w} | {r["days"]} | {r["mean"]:.1f} | {r["median"]:.1f} | {r["pct_days_over_10"]:.0f} | {r["pct_days_zero"]:.0f} |')
    return '\n'.join(lines) + '\n'


if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--write', metavar='PATH')
    args = ap.parse_args()
    res, n = run(load_bars())
    text = report(res, n)
    print(text)
    if args.write:
        Path(args.write).write_text(text, encoding='utf-8')
