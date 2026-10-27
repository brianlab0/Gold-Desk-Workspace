import {useState} from 'react';
import Decimal from 'decimal.js';
import type {Draft} from './types';
import {budgetBasis,lotFromBudget,rangeFor,snapshot} from './rangeMath';

/** Historical adverse-move range for this draft, plus a budget-to-lot helper.
 *  Descriptive only: no forecast, no loss cap, and it never edits the draft. */
export default function VolatilityRange({draft}:{draft:Draft}){
 const [budget,setBudget]=useState('');
 const range=rangeFor(snapshot,draft.side,draft.price,draft.lot);
 if(range.status!=='AVAILABLE')return <section className="vol-range" aria-label="波動風險範圍"><h4>近期波動範圍</h4><p className="fine">{range.reason}</p></section>;
 const hour=range.rows.find(r=>r.horizon==='1h');
 const basis=budgetBasis(draft.price,draft.sl,range);
 const result=budget.trim()&&basis?lotFromBudget(budget.trim(),basis.perOz):null;
 const over=result?.status==='AVAILABLE'&&new Decimal(draft.lot).gt(result.lot);
 return <section className="vol-range" aria-label="波動風險範圍">
  <h4>近期波動範圍</h4>
  {hour&&<p>過去 {range.tradingDays} 個交易日，持有 1 小時的不利變動有 95% 在 {hour.p95PerOz} 美元／盎司以內，換算本筆約 {hour.p95Usd} 美元。這是歷史描述，不是損失上限。</p>}
  <table className="vol-table"><thead><tr><th scope="col">持有時間</th><th scope="col">一半情況內</th><th scope="col">95% 情況內</th></tr></thead>
   <tbody>{range.rows.map(r=><tr key={r.horizon}><th scope="row">{r.label}</th>
    <td>{r.p50PerOz} 美元／盎司<br/><span className="fine">本筆約 {r.p50Usd} 美元</span></td>
    <td>{r.p95PerOz} 美元／盎司<br/><span className="fine">本筆約 {r.p95Usd} 美元</span></td></tr>)}</tbody></table>
  <details><summary>算法與限制</summary>
   <p className="fine">{range.definition}。以 {range.tradingDays} 個交易日（{range.windowStart} 至 {range.windowEnd}，擷取於 {range.generatedAt}）的 5 分鐘資料計算，百分比再套用到本筆擬成交價與手數，每手以 100 盎司換算。</p>
   <p className="fine">資料來源：{range.source}。{range.sourceNote}</p>
   <p className="fine">相鄰視窗大量重疊，實際獨立樣本比筆數少，持有越久越明顯；各時段波動不同（美股開盤前後通常較大），此處混合計算。滾動驗證（docs/volatility_range_validation_20261028.md）顯示 15 分鐘與 1 小時的 95% 範圍平均大致守得住，但 4 小時逐日差異很大（多數日子用不到、少數日子被大幅突破），只能當粗略參考。未含價差、佣金、隔夜費、跳空與滑價，也不代表之後的行情。</p>
  </details>
  <div className="vol-budget">
   <label htmlFor="vol-budget-input">這筆最多願意承擔的不利變動金額（美元）</label>
   <input id="vol-budget-input" type="text" inputMode="decimal" autoComplete="off" placeholder="例如 500" value={budget} onChange={e=>setBudget(e.target.value)}/>
   {result?.status==='AVAILABLE'&&<p>以{basis!.text}估算，手數上限約 <b>{result.lot} 手</b>（約 {result.lossAtLot} 美元）。目前草稿 {draft.lot} 手，{over?'高於':'未超過'}這個參考上限。未含價差、佣金、跳空與滑價。</p>}
   {result?.status==='BELOW_MINIMUM'&&<p>以{basis!.text}估算，這個金額不足以下最小手數 0.01 手（約 {result.lossAtMinLot} 美元）。</p>}
   {result?.status==='INVALID'&&<p role="alert">{result.reason}</p>}
   <p className="fine">只是試算，不會修改草稿；是否調整手數由你決定。</p>
  </div>
 </section>;
}
