import {useState} from 'react';
import Decimal from 'decimal.js';
import type {Draft} from './types';
import {budgetBasis,lotFromBudget,rangeFor,snapshot,stopTouch} from './rangeMath';

const touchText=(pct:number)=>pct===0?'近期沒出現過':pct<=1?'約 1% 或更少':`約 ${pct}%`;

/** Plain-language recent-volatility reference for this draft, with the user's stop placed in it
 *  and a budget-to-lot helper. Descriptive only: no forecast, no loss cap, never edits the draft. */
export default function VolatilityRange({draft}:{draft:Draft}){
 const [budget,setBudget]=useState('');
 const range=rangeFor(snapshot,draft.side,draft.price,draft.lot);
 if(range.status!=='AVAILABLE')return <section className="vol-range" aria-label="波動風險範圍"><h4>近期波動範圍</h4><p className="fine">{range.reason}</p></section>;
 const hour=range.rows.find(r=>r.horizon==='1h');
 const stop=stopTouch(snapshot,draft.side,draft.price,draft.sl);
 const basis=budgetBasis(draft.price,draft.sl,range);
 const result=budget.trim()&&basis?lotFromBudget(budget.trim(),basis.perOz):null;
 const over=result?.status==='AVAILABLE'&&new Decimal(draft.lot).gt(result.lot);
 return <section className="vol-range" aria-label="波動風險範圍">
  <h4>近期波動範圍</h4>
  {hour&&<p>最近 {range.tradingDays} 個交易日，如果持有 1 小時：100 次裡有 95 次，價格對你不利的走勢不超過 <b>{hour.p95PerOz} 美元／盎司</b>（這筆約 {hour.p95Usd} 美元）。其餘 5 次可能更大。這是過去的紀錄，不是預測，也不是損失上限。</p>}
  <table className="vol-table"><thead><tr><th scope="col">持有多久</th>
   <th scope="col">一般情況<br/><span className="fine">一半的時候不超過</span></th>
   <th scope="col">較大波動<br/><span className="fine">100 次有 95 次不超過</span></th></tr></thead>
   <tbody>{range.rows.map(r=><tr key={r.horizon}><th scope="row">{r.label}{r.horizon==='4h'&&<><br/><span className="fine">僅供粗略參考</span></>}</th>
    <td>{r.p50PerOz} 美元／盎司<br/><span className="fine">這筆約 {r.p50Usd} 美元</span></td>
    <td>{r.p95PerOz} 美元／盎司<br/><span className="fine">這筆約 {r.p95Usd} 美元</span></td></tr>)}</tbody></table>
  {stop?<div className="vol-stop"><p>你的停損離進場價 <b>{stop.distancePerOz} 美元／盎司</b>。過去有幾成的時間，價格會走到這個距離（停損可能被碰到）：</p>
   <ul>{stop.rows.map(r=><li key={r.horizon}>持有 {r.label}：{touchText(r.sharePct)}</li>)}</ul>
   <p className="fine">比例越高，代表停損越容易被一般的上下波動碰到。這是過去的紀錄，沒算價差與滑價。</p></div>
   :<p className="fine">還沒設停損，所以算不出停損會被碰到的比例。</p>}
  <details><summary>資料從哪來、有什麼限制</summary>
   <ul className="fine">
    <li>用最近 {range.tradingDays} 個交易日（{range.windowStart} 至 {range.windowEnd}）的 5 分鐘行情算，擷取於 {range.generatedAt}，不會自動更新。</li>
    <li>來源是 {range.source}。{range.sourceNote}</li>
    <li>做法：每個時間點往後看到持有結束，記下價格對你最不利的位置，再排序取一半與 95% 的位置，換成這筆的價格與手數（每手 100 盎司）。</li>
    <li>一天裡有安靜的時段也有劇烈的時段（例如美股開盤前後），這裡全部混在一起算，實際可能比表上大或小。</li>
    <li>相鄰的時間點資料大量重疊，所以實際參考的獨立情況比表面少，持有越久越明顯。</li>
    <li>回頭檢查時，15 分鐘與 1 小時大致守得住；4 小時有的日子用不到、有的日子被大幅超過，只能粗略參考（docs/volatility_range_validation_20261028.md）。</li>
    <li>沒算價差、手續費、隔夜費、跳空與滑價，也不代表之後的行情。</li>
   </ul>
  </details>
  <div className="vol-budget">
   <label htmlFor="vol-budget-input">這筆你最多願意虧多少美元？</label>
   <input id="vol-budget-input" type="text" inputMode="decimal" autoComplete="off" placeholder="例如 500" value={budget} onChange={e=>setBudget(e.target.value)}/>
   {result?.status==='AVAILABLE'&&<p>照{basis!.text}算，這筆最多可以下約 <b>{result.lot} 手</b>（約虧 {result.lossAtLot} 美元）。你現在的草稿是 {draft.lot} 手，{over?'已經超過':'沒有超過'}。</p>}
   {result?.status==='BELOW_MINIMUM'&&<p>照{basis!.text}算，這個金額連最小的 0.01 手都不夠（0.01 手約虧 {result.lossAtMinLot} 美元）。</p>}
   {result?.status==='INVALID'&&<p role="alert">{result.reason}</p>}
   <p className="fine">只是試算，不會改你的草稿，要不要調整手數由你決定。沒算價差、手續費、跳空與滑價。</p>
  </div>
 </section>;
}
