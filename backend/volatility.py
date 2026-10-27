"""Historical adverse-move range and volatility context from closed 5-minute bars.

Pure functions: no network, no broker, no LLM. Every number is a description of
what already happened in the supplied window, never a forecast or a loss cap.

Definitions
-----------
adverse move (MAE): for a window that starts after a reference close, how far
price moved against the position at its worst point inside the window.
BUY -> reference close minus the lowest low; SELL -> highest high minus the
reference close. This matches the "max adverse excursion" used for the matched
historical cases, so numbers with and without similar cases are comparable.

All moves are returned as a percentage of the reference close so they can be
applied to any entry price (the replay and the real market trade at different
absolute price levels).
"""
from __future__ import annotations

import json
from decimal import Decimal, ROUND_FLOOR, InvalidOperation
from math import ceil
from pathlib import Path

BAR_SECONDS = 300
HORIZON_BARS = {'15m': 3, '1h': 12, '4h': 48}
D = Decimal


def percentile(values: list[float], pct: float) -> float:
    """Nearest-rank percentile (no interpolation) so results are reproducible by hand."""
    if not values:
        raise ValueError('empty sample')
    if not 0 < pct <= 100:
        raise ValueError('pct must be in (0, 100]')
    ordered = sorted(values)
    rank = max(1, ceil(pct / 100 * len(ordered)))
    return ordered[rank - 1]


def _contiguous(bars: list[dict], start: int, count: int) -> bool:
    """True when bars[start .. start+count] are consecutive 5-minute bars (no gap)."""
    return bars[start + count]['time'] - bars[start]['time'] == count * BAR_SECONDS


def adverse_moves(bars: list[dict], side: str, bars_ahead: int) -> list[float]:
    """Adverse move, in percent of the reference close, for every window of `bars_ahead` bars.

    bars: closed 5-minute bars sorted by time, each {time, high, low, close}.
    Windows that span a market break or missing bar are skipped, not stitched.
    """
    if side not in ('BUY', 'SELL'):
        raise ValueError('side must be BUY or SELL')
    if bars_ahead < 1:
        raise ValueError('bars_ahead must be positive')
    out: list[float] = []
    for i in range(len(bars) - bars_ahead):
        if not _contiguous(bars, i, bars_ahead):
            continue
        ref = float(bars[i]['close'])
        if ref <= 0:
            continue
        window = bars[i + 1:i + 1 + bars_ahead]
        if side == 'BUY':
            move = ref - min(float(b['low']) for b in window)
        else:
            move = max(float(b['high']) for b in window) - ref
        out.append(max(0.0, move) / ref * 100)
    return out


def adverse_ranges(bars: list[dict], horizons: dict[str, int] | None = None,
                   percentiles: tuple[float, ...] = (50, 95)) -> dict:
    """p50/p95 adverse move per side and horizon, plus the sample sizes behind them."""
    horizons = horizons or HORIZON_BARS
    result: dict = {}
    for side in ('BUY', 'SELL'):
        result[side] = {}
        for name, n in horizons.items():
            sample = adverse_moves(bars, side, n)
            if not sample:
                result[side][name] = dict(status='INSUFFICIENT', windows=0)
                continue
            result[side][name] = dict(
                status='AVAILABLE', windows=len(sample),
                **{f'p{int(p)}_pct': round(percentile(sample, p), 4) for p in percentiles},
                # p1..p100 so a stop distance can be placed inside the distribution
                quantiles_pct=[round(percentile(sample, k), 4) for k in range(1, 101)])
    return result


def true_ranges(bars: list[dict]) -> list[float]:
    """True range per bar (needs the previous close, so the first bar is dropped)."""
    out = []
    for prev, cur in zip(bars, bars[1:]):
        if cur['time'] - prev['time'] != BAR_SECONDS:
            out.append(float('nan'))
            continue
        hi, lo, pc = float(cur['high']), float(cur['low']), float(prev['close'])
        out.append(max(hi - lo, abs(hi - pc), abs(lo - pc)))
    return out


def atr_percent_series(bars: list[dict], period: int = 14) -> list[tuple[int, float]]:
    """(time, ATR as % of close) using a plain mean of the last `period` true ranges."""
    trs = true_ranges(bars)
    series = []
    for i in range(period - 1, len(trs)):
        window = trs[i - period + 1:i + 1]
        if any(v != v for v in window):  # NaN from a gap
            continue
        bar = bars[i + 1]
        close = float(bar['close'])
        if close > 0:
            series.append((bar['time'], sum(window) / period / close * 100))
    return series


def volatility_percentile(bars: list[dict], period: int = 14) -> dict:
    """Where the latest ATR% sits among the earlier ATR% values in the same window.

    Only earlier values are used as the reference, so the latest reading never
    ranks itself. Returns a rank in [0, 100], not a probability.

    Limitation: gold volatility has a strong time-of-day pattern (quiet late
    session, busy US open). The reference mixes all hours, so a reading taken in
    a quiet hour ranks low for that reason alone. Compare like-for-like hours
    before presenting this to a user as "the market is calm".
    """
    series = atr_percent_series(bars, period)
    if len(series) < 50:
        return dict(status='INSUFFICIENT', reason='已收棒不足，無法建立波動基準', samples=len(series))
    latest_time, latest = series[-1]
    history = [v for _, v in series[:-1]]
    rank = sum(1 for v in history if v <= latest) / len(history) * 100
    return dict(status='AVAILABLE', rank=round(rank, 1), latest_atr_pct=round(latest, 4),
                samples=len(history), as_of_time=latest_time)


def lot_from_budget(budget_usd: str, loss_per_oz_usd: str, oz_per_lot: str = '100',
                    step: str = '0.01', maximum: str = '100') -> dict:
    """Largest lot size whose loss at `loss_per_oz_usd` stays within the budget.

    Floors to the lot step (never rounds up past the budget). All Decimal, all strings.
    """
    try:
        budget, per_oz = D(str(budget_usd)), D(str(loss_per_oz_usd))
        oz, unit, cap = D(str(oz_per_lot)), D(str(step)), D(str(maximum))
    except Exception:
        return dict(status='INVALID', reason='數值格式無效', lot=None)
    if not all(v.is_finite() for v in (budget, per_oz, oz, unit, cap)):
        return dict(status='INVALID', reason='數值須為有限數字', lot=None)
    if budget <= 0 or per_oz <= 0 or oz <= 0 or unit <= 0 or cap <= 0:
        return dict(status='INVALID', reason='預算與每盎司不利變動須大於零', lot=None)
    raw = budget / (per_oz * oz)
    lot = (raw / unit).to_integral_value(rounding=ROUND_FLOOR) * unit
    capped = lot > cap
    lot = min(lot, cap)
    if lot < unit:
        return dict(status='BELOW_MINIMUM', reason='預算不足以下最小手數', lot=None,
                    loss_at_min_lot=str((unit * per_oz * oz).quantize(D('0.01'))))
    return dict(status='AVAILABLE', lot=format(lot.normalize(), 'f'),
                loss_at_lot=str((lot * per_oz * oz).quantize(D('0.01'))), capped=capped)


def touch_share(quantiles_pct: list[float], stop_pct: float) -> int:
    """Whole-percent share of historical windows whose adverse move reached `stop_pct`.

    `quantiles_pct` is the p1..p100 grid (non-decreasing). A stop is touched when the
    adverse move is at least the stop distance, so equal counts as touched. Resolution is
    1 percentage point; it is a description of the snapshot window, not a probability.
    """
    if len(quantiles_pct) != 100:
        raise ValueError('need the p1..p100 grid')
    if stop_pct <= 0:
        raise ValueError('stop distance must be positive')
    return sum(1 for q in quantiles_pct if q >= stop_pct)


SNAPSHOT_PATH = Path(__file__).resolve().parents[1] / 'frontend' / 'src' / 'volatility-snapshot.json'


def load_snapshot(path: Path = SNAPSHOT_PATH) -> dict | None:
    try:
        return json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None


def volatility_fact(draft: dict, snapshot: dict | None = None) -> dict | None:
    """Program-written fact for the explanation catalog; None when it cannot be computed.

    Text is plain language and carries every number itself, so the model can only select it.
    """
    snap = snapshot if snapshot is not None else load_snapshot()
    try:
        side, price, lot = draft['side'], D(str(draft['price'])), D(str(draft['lot']))
        entry = snap['ranges'][side]['1h']
        if entry['status'] != 'AVAILABLE' or price <= 0 or lot <= 0 or not price.is_finite() or not lot.is_finite():
            return None
        p95_oz = price * D(str(entry['p95_pct'])) / 100
        p95_usd = p95_oz * lot * 100
        days = snap['window']['trading_days']
        text = (f'近 {days} 個交易日，持有 1 小時，100 次裡有 95 次價格對這筆單不利的走勢不超過 '
                f'{p95_oz:.2f} 美元／盎司（本筆約 {p95_usd:.2f} 美元）。這是過去的紀錄，不是預測，也不是損失上限。')
        data = dict(horizon='1h', window_trading_days=days, p95_usd_per_oz=f'{p95_oz:.2f}',
                    p95_this_order_usd=f'{p95_usd:.2f}', source=snap['source'], generated_at=snap['generated_at'][:10])
        sl = draft.get('sl')
        if sl not in (None, ''):
            stop = abs(price - D(str(sl)))
            if stop.is_finite() and stop > 0:
                share = {h: touch_share(snap['ranges'][side][h]['quantiles_pct'], float(stop / price * 100))
                         for h in ('15m', '1h', '4h') if snap['ranges'][side][h].get('status') == 'AVAILABLE'}
                if '1h' in share:
                    text += f' 你設定的停損離進場價 {stop:.2f} 美元／盎司，過去持有 1 小時約有 {share["1h"]}% 的時間價格會走到這個距離。'
                data.update(stop_distance_usd_per_oz=f'{stop:.2f}', stop_touch_share_pct=share)
        return dict(text=text, data=data)
    except (KeyError, TypeError, ValueError, InvalidOperation, ArithmeticError):
        return None
