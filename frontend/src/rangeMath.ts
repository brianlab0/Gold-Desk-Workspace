/** Historical adverse-move range and budget-to-lot helper.
 *
 * Pure Decimal functions over a derived snapshot (see scripts/build_volatility_snapshot.py).
 * Same definitions and rounding as backend/volatility.py. Descriptions of what
 * already happened in the snapshot window; never a forecast or a loss cap.
 */
import Decimal from 'decimal.js';
import bundled from './volatility-snapshot.json';

export type Side='BUY'|'SELL';
export type HorizonKey='15m'|'1h'|'4h';
export const HORIZONS:HorizonKey[]=['15m','1h','4h'];
export const HORIZON_LABEL:Record<HorizonKey,string>={'15m':'15 分鐘','1h':'1 小時','4h':'4 小時'};

type RangeEntry={status:string;windows:number;p50_pct?:number;p95_pct?:number};
export type Snapshot={
  source:string;source_note:string;generated_at:string;
  window:{trading_days:number;bars:number;start_utc:string;end_utc:string};
  method:{definition:string;percentile:string;windows_overlap:boolean;skips:string};
  ranges:Record<Side,Record<string,RangeEntry>>;
};
export const snapshot=bundled as unknown as Snapshot;

const d=(v:Decimal.Value)=>new Decimal(v);
const usd=(v:Decimal)=>v.toFixed(2);
/** Per-ounce figures keep more digits than whole dollars so small moves stay visible. */
const perOz=(v:Decimal)=>v.toFixed(2);

export type RangeRow={horizon:HorizonKey;label:string;windows:number;
  p50PerOz:string;p95PerOz:string;p50Usd:string;p95Usd:string};
export type RangeResult=
  |{status:'AVAILABLE';rows:RangeRow[];tradingDays:number;windowStart:string;windowEnd:string;
    source:string;sourceNote:string;generatedAt:string;definition:string;overlap:boolean}
  |{status:'UNAVAILABLE';reason:string};

function positive(raw:string,label:string):Decimal|string{
  try{const v=d(raw);if(!v.isFinite()||v.lte(0))return label+'須為大於零的有效數字';return v;}
  catch{return label+'須為大於零的有效數字';}
}

/** p50/p95 adverse move for this draft: percent of the reference price, applied to the entry price. */
export function rangeFor(snap:Snapshot,side:Side,price:string,lot:string,ozPerLot='100'):RangeResult{
  const p=positive(price,'擬成交價'),l=positive(lot,'手數'),oz=positive(ozPerLot,'每手盎司數');
  for(const bad of [p,l,oz])if(typeof bad==='string')return {status:'UNAVAILABLE',reason:bad};
  const entry=p as Decimal,qty=l as Decimal,units=oz as Decimal;
  const rows:RangeRow[]=[];
  for(const h of HORIZONS){
    const r=snap.ranges?.[side]?.[h];
    if(!r||r.status!=='AVAILABLE'||typeof r.p50_pct!=='number'||typeof r.p95_pct!=='number')continue;
    const p50=entry.times(r.p50_pct).div(100),p95=entry.times(r.p95_pct).div(100);
    rows.push({horizon:h,label:HORIZON_LABEL[h],windows:r.windows,
      p50PerOz:perOz(p50),p95PerOz:perOz(p95),p50Usd:usd(p50.times(qty).times(units)),p95Usd:usd(p95.times(qty).times(units))});
  }
  if(!rows.length)return {status:'UNAVAILABLE',reason:'快照沒有足夠的 5 分鐘資料，無法提供波動範圍。'};
  return {status:'AVAILABLE',rows,tradingDays:snap.window.trading_days,
    windowStart:snap.window.start_utc.slice(0,10),windowEnd:snap.window.end_utc.slice(0,10),
    source:snap.source,sourceNote:snap.source_note,generatedAt:snap.generated_at.slice(0,10),
    definition:snap.method.definition,overlap:snap.method.windows_overlap};
}

export type BudgetResult=
  |{status:'AVAILABLE';lot:string;lossAtLot:string;capped:boolean}
  |{status:'BELOW_MINIMUM';lossAtMinLot:string}
  |{status:'INVALID';reason:string};

/** Largest lot whose loss at `lossPerOz` stays within the budget; floors to the lot step. */
export function lotFromBudget(budgetUsd:string,lossPerOz:string,ozPerLot='100',step='0.01',maximum='100'):BudgetResult{
  let budget:Decimal,per:Decimal,oz:Decimal,unit:Decimal,cap:Decimal;
  try{budget=d(budgetUsd);per=d(lossPerOz);oz=d(ozPerLot);unit=d(step);cap=d(maximum);}
  catch{return {status:'INVALID',reason:'數值格式無效'};}
  if(![budget,per,oz,unit,cap].every(v=>v.isFinite()))return {status:'INVALID',reason:'數值須為有限數字'};
  if([budget,per,oz,unit,cap].some(v=>v.lte(0)))return {status:'INVALID',reason:'預算與每盎司不利變動須大於零'};
  let lot=budget.div(per.times(oz)).div(unit).floor().times(unit);
  const capped=lot.gt(cap);if(capped)lot=cap;
  if(lot.lt(unit))return {status:'BELOW_MINIMUM',lossAtMinLot:usd(unit.times(per).times(oz))};
  return {status:'AVAILABLE',lot:lot.toString(),lossAtLot:usd(lot.times(per).times(oz)),capped};
}

export type Basis={source:'STOP'|'P95_1H';perOz:string;text:string};
/** Distance used to turn a budget into a lot size: the user's stop if there is one, else the 1-hour 95% move. */
export function budgetBasis(price:string,sl:string|null,range:RangeResult):Basis|null{
  try{
    const stop=sl?d(price).minus(d(sl)).abs():null;
    if(stop&&stop.isFinite()&&stop.gt(0))return {source:'STOP',perOz:stop.toFixed(2),text:`你設定的停損距離 ${stop.toFixed(2)} 美元／盎司`};
  }catch{/* fall through to the historical distance */}
  if(range.status!=='AVAILABLE')return null;
  const hour=range.rows.find(r=>r.horizon==='1h');
  return hour?{source:'P95_1H',perOz:hour.p95PerOz,text:`沒有設定停損，改用近期持有 1 小時的 95% 不利變動 ${hour.p95PerOz} 美元／盎司作參考距離（這不是停損）`}:null;
}
