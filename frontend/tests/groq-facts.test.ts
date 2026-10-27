import {test} from 'node:test';
import assert from 'node:assert/strict';
import {withVolatility,volatilityBlock,FACTS_SOFT_LIMIT} from '../src/groqFacts';
import {rangeFor,snapshot} from '../src/rangeMath';
import type {Draft} from '../src/types';

const draft=(sl:string|null)=>({side:'BUY',lot:'0.20',price:'2928.05',sl,tp:null,risk:{stop_loss_usd:null}}) as unknown as Draft;
// Same shape and similar size as the object built in groqProxy.ts
const base=()=>({source:'synthetic_demo',mode:'replay',broker_connected:false,clock_utc:1793127000,
 market_last_60_5m_bars:{high:'2935.74',low:'2927.21',change_pct:'-0.12',range_pct:'0.29',ma20:'2930.11',ma60:'2931.44'},
 case_comparison:{scope:'operation_only',groups:618,wins:410,losses:120,flat:8,unknown:80,market_reason:'歷史K線與盤面相似度尚未核實，只比較操作條件'},
 order:{status:'REVIEW',side:'BUY',lot:'0.20',price:'2928.05',stop_loss_usd:null},
 note:'當前回放行情與模擬下單為合成資料；案例彙總來自公開的真實交易員紀錄。未連券商；歷史案例的券商時鐘未獨立核實。'});

test('adds a compact block whose numbers equal the range shown on screen',()=>{
 const out=withVolatility(base(),draft(null)) as Record<string,any>;
 const shown=rangeFor(snapshot,'BUY','2928.05','0.20');
 assert.equal(shown.status,'AVAILABLE');if(shown.status!=='AVAILABLE')return;
 const hour=shown.rows.find(r=>r.horizon==='1h')!;
 assert.equal(out.volatility.p95_usd_per_oz,hour.p95PerOz);
 assert.equal(out.volatility.p95_this_order_usd,hour.p95Usd);
 assert.equal(out.volatility.hold,'1h');
 assert.ok(!('stop_distance_usd_per_oz' in out.volatility));
 assert.match(out.volatility.note,/不是預測也不是損失上限/);
});

test('with a stop it also carries the distance and how often it was reached',()=>{
 const out=withVolatility(base(),draft('2916.05')) as Record<string,any>;   // 12.00 below
 assert.equal(out.volatility.stop_distance_usd_per_oz,'12.00');
 assert.equal(typeof out.volatility.stop_touch_pct_1h,'number');
});

test('the whole facts string stays under the proxy limit of 1500 characters',()=>{
 for(const d of [draft(null),draft('2916.05')]){
  const text=JSON.stringify(withVolatility(base(),d));
  assert.ok(text.length<=FACTS_SOFT_LIMIT,String(text.length));
  assert.ok(text.length<1500);
 }
});

test('it is left out rather than risk the proxy rejecting the request',()=>{
 const crowded={...base(),extra:'x'.repeat(1300)};
 assert.deepEqual(withVolatility(crowded,draft(null)),crowded);
});

test('no draft or an unusable draft leaves the facts unchanged',()=>{
 assert.deepEqual(withVolatility(base(),null),base());
 assert.deepEqual(withVolatility(base(),{...draft(null),price:'abc'} as Draft),base());
 assert.equal(volatilityBlock(null),null);
});

test('adding it never changes the existing facts',()=>{
 const before=base(),out=withVolatility(before,draft(null)) as Record<string,unknown>;
 for(const k of Object.keys(before))assert.deepEqual(out[k],(before as Record<string,unknown>)[k],k);
});
