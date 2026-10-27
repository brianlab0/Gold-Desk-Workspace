/** Adds the recent-volatility numbers to the facts sent to the Groq explanation proxy.
 *
 * Pure module (no import.meta) so it can be tested. The deployed proxy rejects a `facts`
 * string longer than 1500 characters, which would silently drop the whole Groq answer,
 * so the volatility block is added only when the result still fits with room to spare.
 */
import type {Draft} from './types';
import {rangeFor,snapshot as bundled,stopTouch,type Snapshot} from './rangeMath';

/** The proxy's hard limit is 1500; stay clear of it. */
export const FACTS_SOFT_LIMIT=1400;

export function volatilityBlock(draft:Draft|null,snap:Snapshot=bundled):Record<string,unknown>|null{
  if(!draft)return null;
  const range=rangeFor(snap,draft.side,draft.price,draft.lot);
  if(range.status!=='AVAILABLE')return null;
  const hour=range.rows.find(r=>r.horizon==='1h');
  if(!hour)return null;
  const stop=stopTouch(snap,draft.side,draft.price,draft.sl);
  const touch1h=stop?.rows.find(r=>r.horizon==='1h')?.sharePct;
  return {
    window_trading_days:range.tradingDays,hold:'1h',
    p95_usd_per_oz:hour.p95PerOz,p95_this_order_usd:hour.p95Usd,
    ...(stop&&touch1h!==undefined?{stop_distance_usd_per_oz:stop.distancePerOz,stop_touch_pct_1h:touch1h}:{}),
    note:'過去紀錄，期貨資料，不是預測也不是損失上限',
  };
}

/** Returns `base` plus a `volatility` block when it fits; otherwise `base` unchanged. */
export function withVolatility(base:Record<string,unknown>,draft:Draft|null,snap:Snapshot=bundled,limit:number=FACTS_SOFT_LIMIT):Record<string,unknown>{
  const block=volatilityBlock(draft,snap);
  if(!block)return base;
  const candidate={...base,volatility:block};
  return JSON.stringify(candidate).length<=limit?candidate:base;
}
