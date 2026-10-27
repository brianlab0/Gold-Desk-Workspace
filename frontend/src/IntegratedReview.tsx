import type {ReactNode} from 'react';
import type {Draft} from './types';
import {RuleResults} from './PersonalRulesPanel';
import {Term} from './Education';
import VolatilityRange from './VolatilityRange';

export function RiskReview({draft}:{draft:Draft}){
 const {risk}=draft;
 return <section className="integrated-risk" aria-label="部位與價格風險">
  <div className="risk-grid"><span>總曝險手數<b>{risk.before_lot} → {risk.after_lot}</b></span><span>同方向均價<b>{risk.average_entry}</b></span><span>停損價格情境 <Term id="scenario"/><b>{risk.stop_loss_usd===null?(draft.sl?'無法計算':'未設定停損'):risk.stop_loss_usd+' USD'}</b></span><span>風險報酬比 <Term id="ratio"/><b>{risk.reward_risk??'資料不足'}</b></span></div>
  {risk.warnings.length>0&&<div className="warning-box" role="note">{risk.warnings.map((warning,i)=><p key={i}>{warning}</p>)}</div>}
  <details><summary>價格移動情境</summary><div className="scenario-row">{risk.scenarios.map((s,i)=><span key={i}>價格移動 {s.move}<b>{s.loss.startsWith('-')?'獲利 '+s.loss.slice(1):'損失 '+s.loss} USD</b></span>)}</div><p className="fine">情境試算不是價格預測或損失上限，不涵蓋所有滑價與費用。</p></details>
  <VolatilityRange draft={draft}/>
 </section>;
}

export default function IntegratedReview({draft,source,cases,explanation}:{draft:Draft;source:string;cases:ReactNode;explanation:ReactNode}){
 const results=draft.personal_rules?.results??[];
 const attention=results.filter(r=>r.status==='triggered'||r.status==='unknown');
 return <div className="integrated-review">
  <div className="review-order"><span>{draft.order_type==='LIMIT'?'指定限價':'擬成交價'} <b>{draft.price}</b></span><span>停損 <b>{draft.sl??'未設定'}</b></span><span>停利 <b>{draft.tp??'未設定'}</b></span></div>
  <p className="fine">{source} · 尚未確認委託；以下保留草稿建立時的資料。</p>
  <h3>01 部位與價格風險</h3><RiskReview draft={draft}/>
  <h3>02 個人提醒</h3>
  {attention.length>0&&<div className="warning-box">{attention.map(r=><p key={r.id}><strong>{r.status==='unknown'?'無法評估':'觸發提醒'}：{r.text}</strong> · {r.reason}</p>)}</div>}
  <details><summary>{results.length?`查看 ${results.length} 項提醒結果`:'尚未設定個人提醒'}</summary><RuleResults check={draft.personal_rules}/><p className="fine">只提醒，不代替你確認委託。</p></details>
  <h3>03 相似歷史案例</h3>{cases}
  <h3>04 證據是否充分</h3><p>{draft.retrieval.sufficiency?.label??'依案例來源與限制判讀'}</p><p className="fine">歷史結果描述匹配案例，不是這筆交易的獲利機率。</p><details><summary>資料限制與判斷依據</summary>{[...(draft.retrieval.sufficiency?.reasons??[]),...draft.retrieval.limitations].map((text,i)=><p className="fine" key={i}>{text}</p>)}</details>
  <h3>05 檢查說明</h3><p className="fine">行情變動不會改寫這份分析；確認時仍須通過原有版本與防重送檢查。</p>{explanation}
 </div>;
}
