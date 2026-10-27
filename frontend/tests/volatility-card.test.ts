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

test('shows the range with its method and the "not a loss cap" statement',()=>{
 const out=html(base);
 assert.match(out,/過去 20 個交易日，持有 1 小時的不利變動有 95%/);
 assert.match(out,/這是歷史描述，不是損失上限/);
 assert.match(out,/算法與限制/);assert.match(out,/相鄰視窗大量重疊/);assert.match(out,/4 小時逐日差異很大/);assert.match(out,/Yahoo Finance GC=F/);
 for(const label of ['15 分鐘','1 小時','4 小時'])assert.ok(out.includes(label),label);
});

test('never uses the words reserved for a real loss limit, with or without a stop',()=>{
 for(const d of [base,{...base,sl:'3900'} as Draft]){
  const out=html(d);
  assert.doesNotMatch(out,/最大損失|損失上限(?!。)/);
  assert.doesNotMatch(out,/帳戶.{0,6}%|淨值|餘額/);
 }
});

test('budget distance is the user stop when one exists, otherwise the 1-hour 95% move and it says so',()=>{
 const range=rangeFor(snapshot,'BUY','4000','0.10');
 const withStop=budgetBasis('4000','3900',range)!;
 assert.equal(withStop.source,'STOP');assert.equal(withStop.perOz,'100.00');assert.match(withStop.text,/你設定的停損距離/);
 assert.doesNotMatch(withStop.text,/沒有設定停損/);
 const noStop=budgetBasis('4000',null,range)!;
 assert.equal(noStop.source,'P95_1H');assert.match(noStop.text,/沒有設定停損/);assert.match(noStop.text,/這不是停損/);
 assert.equal(budgetBasis('4000','4000',range)!.source,'P95_1H');   // stop equal to price is not a distance
 assert.equal(budgetBasis('4000','abc',range)!.source,'P95_1H');    // unreadable stop never crashes
 assert.equal(budgetBasis('abc',null,rangeFor(snapshot,'BUY','abc','1')),null);
});

test('initial screen never claims a stop situation either way',()=>{
 assert.doesNotMatch(html({...base,sl:'3900'} as Draft),/未設定停損|沒有設定停損/);
 assert.doesNotMatch(html(base),/未設定停損/);
});

test('invalid price degrades to a plain message instead of inventing numbers',()=>{
 const out=html({...base,price:'abc'} as Draft);
 assert.match(out,/須為大於零的有效數字/);assert.doesNotMatch(out,/95%/);
});

test('it is part of the shared risk review so both review screens get it',()=>{
 assert.match(renderToStaticMarkup(createElement(RiskReview,{draft:base})),/近期波動範圍/);
});

test('rendering is read-only: the draft object is not changed',()=>{
 const before=JSON.stringify(base);html(base);assert.equal(JSON.stringify(base),before);
});
