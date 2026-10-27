"""Build frontend/src/volatility-snapshot.json from recent real 5-minute gold bars.

Needs: pip install yfinance   (not a runtime dependency of the app)

Only DERIVED summary numbers are written (percentiles and counts). Raw bars are
never written to the repository. The result is a historical description for the
window named in the file, not a forecast and not a loss cap.

Source caveat: Yahoo Finance GC=F is COMEX gold futures, not spot XAUUSD and not
a broker quote. Replace `load_bars` with broker bars (cTrader) when available;
backend/volatility.py accepts any list of closed 5-minute bars.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from backend.volatility import HORIZON_BARS, adverse_ranges  # noqa: E402

OUT = ROOT / 'frontend' / 'src' / 'volatility-snapshot.json'
TRADING_DAYS = 20
MIN_BARS_PER_DAY = 100  # skips holiday stubs and a barely-started current day


def load_bars(symbol: str = 'GC=F') -> list[dict]:
    import yfinance as yf
    df = yf.download(symbol, period='60d', interval='5m', progress=False, auto_adjust=True)
    if df.empty:
        raise SystemExit('no data returned')
    df.columns = df.columns.get_level_values(0)
    df = df.dropna(subset=['High', 'Low', 'Close'])
    return [dict(time=int(ts.timestamp()), high=float(r.High), low=float(r.Low), close=float(r.Close))
            for ts, r in df.iterrows()]


def last_trading_days(bars: list[dict], days: int = TRADING_DAYS) -> list[dict]:
    by_date: dict[str, list[dict]] = {}
    for b in bars:
        by_date.setdefault(datetime.fromtimestamp(b['time'], timezone.utc).date().isoformat(), []).append(b)
    kept = [d for d in sorted(by_date) if len(by_date[d]) >= MIN_BARS_PER_DAY][-days:]
    return sorted((b for d in kept for b in by_date[d]), key=lambda b: b['time'])


def main() -> None:
    bars = last_trading_days(load_bars())
    first, last = bars[0]['time'], bars[-1]['time']
    snapshot = dict(
        version=1,
        source='Yahoo Finance GC=F（COMEX 黃金期貨 5 分鐘 K）',
        source_note='期貨資料，不是現貨 XAUUSD，也不是券商報價；僅供歷史波動描述。',
        generated_at=datetime.now(timezone.utc).isoformat(timespec='seconds'),
        window=dict(trading_days=TRADING_DAYS, bars=len(bars),
                    start_utc=datetime.fromtimestamp(first, timezone.utc).isoformat(timespec='minutes'),
                    end_utc=datetime.fromtimestamp(last, timezone.utc).isoformat(timespec='minutes')),
        method=dict(
            definition='持有期間內相對起點收盤價的最大不利變動（買單看最低價、賣單看最高價），以起點收盤價的百分比表示',
            percentile='nearest-rank（不內插）',
            horizons={k: v * 5 for k, v in HORIZON_BARS.items()},
            horizon_unit='minutes',
            windows_overlap=True,
            skips='跨越休市或缺棒的視窗不計入'),
        ranges=adverse_ranges(bars),
    )
    OUT.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print('wrote', OUT.relative_to(ROOT))
    print(json.dumps(snapshot['window'], ensure_ascii=False))
    for side in ('BUY', 'SELL'):
        for h, r in snapshot['ranges'][side].items():
            print(side, h, r)


if __name__ == '__main__':
    main()
