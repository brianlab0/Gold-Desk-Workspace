import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import VolatilityRange from '../src/VolatilityRange';
import {RiskReview} from '../src/IntegratedReview';
import {budgetBasis,rangeFor,snapshot} from '../src/rangeMath';
import type {Draft} from '../src/types';

const base={side:'BUY',lot:'0.10',price:'4000',sl:null,tp:null,
 risk:{before_lot:'0',after_lot:'0.10',average_entry:'4000',stop_loss_usd:null,reward_risk:null,scenarios:[],warnings:[]}} as unknown as Draft;
const html=(d:Draft)=>renderToStaticMarkup(createElement(VolatilityRange,{draft:d}));
const withStop=(sl:string)=>({...base,sl}) as Draft;

test('headline says it in plain words, keeps the not-a-prediction statement, and lists three holding times',()=>{
 const out=html(base);
 assert.match(out,/最近 20 個交易日，如果持有 1 小時：100 次裡有 95 次，價格對你不利的走勢不超過/);
 assert.match(out,/其餘 5 次可能更大/);
 assert.match(out,/這是過去的紀錄，不是預測，也不是損失上限/);
 for(const label of ['15 分鐘','1 小時','4 小時','一般情況','較大波動','一半的時候不超過','100 次有 95 次不超過'])assert.ok(out.includes(label),label);
});

test('no statistics jargon on screen',()=>{
 for(const d of [base,withStop('3900')])assert.doesNotMatch(html(d),/MAE|p95|p50|百分位|nearest|quantile|不利變動/);
});

test('never uses the words reserved for a real loss limit, with or without a stop',()=>{
 for(const d of [base,withStop('3900')]){
  const out=html(d);
  assert.doesNotMatch(out,/最大損失|損失上限(?!。)/);
  assert.doesNotMatch(out,/帳戶.{0,6}%|淨值|餘額/);
 }
});

test('limits are listed in plain language, including the weak 4-hour row',()=>{
 const out=html(base);
 assert.match(out,/資料從哪來、有什麼限制/);assert.match(out,/不會自動更新/);assert.match(out,/Yahoo Finance GC=F/);
 assert.match(out,/全部混在一起算/);assert.match(out,/大量重疊/);assert.match(out,/4 小時有的日子用不到/);
 assert.match(out,/僅供粗略參考/);
});

test('with a stop, shows its distance and how often it was reached at each holding time',()=>{
 const out=html(withStop('3980'));
 assert.match(out,/你的停損離進場價 <b>20\.00 美元／盎司<\/b>/);
 assert.match(out,/持有 15 分鐘：/);assert.match(out,/持有 1 小時：/);assert.match(out,/持有 4 小時：/);
 assert.match(out,/比例越高，代表停損越容易被一般的上下波動碰到/);
 assert.doesNotMatch(out,/還沒設停損/);
});

test('a stop far from price says it was not reached recently; no stop says it cannot be computed',()=>{
 assert.match(html(withStop('3000')),/近期沒出現過/);
 const none=html(base);
 assert.match(none,/還沒設停損，所以算不出停損會被碰到的比例/);assert.doesNotMatch(none,/你的停損離進場價/);
});

test('budget distance is the user stop when one exists, otherwise the 1-hour larger move and it says so',()=>{
 const range=rangeFor(snapshot,'BUY','4000','0.10');
 const s=budgetBasis('4000','3900',range)!;
 assert.equal(s.source,'STOP');assert.equal(s.perOz,'100.00');assert.match(s.text,/你設的停損距離/);assert.doesNotMatch(s.text,/還沒設停損/);
 const n=budgetBasis('4000',null,range)!;
 assert.equal(n.source,'P95_1H');assert.match(n.text,/你還沒設停損/);assert.match(n.text,/這不是停損/);
 assert.equal(budgetBasis('4000','4000',range)!.source,'P95_1H');   // stop equal to price is not a distance
 assert.equal(budgetBasis('4000','abc',range)!.source,'P95_1H');    // unreadable stop never crashes
 assert.equal(budgetBasis('abc',null,rangeFor(snapshot,'BUY','abc','1')),null);
});

test('invalid price degrades to a plain message instead of inventing numbers',()=>{
 const out=html({...base,price:'abc'} as Draft);
 assert.match(out,/須為大於零的有效數字/);assert.doesNotMatch(out,/100 次裡有 95 次/);
});

test('it is part of the shared risk review so both review screens get it',()=>{
 assert.match(renderToStaticMarkup(createElement(RiskReview,{draft:base})),/近期波動範圍/);
});

test('rendering is read-only: the draft object is not changed',()=>{
 const before=JSON.stringify(base);html(base);html(withStop('3980'));assert.equal(JSON.stringify(base),before);
});
