import {test} from 'node:test';
import assert from 'node:assert/strict';
import {rangeFor,lotFromBudget,snapshot,HORIZONS,touchShare,stopTouch,type Snapshot} from '../src/rangeMath';

const fake:Snapshot={
 source:'測試來源',source_note:'測試備註',generated_at:'2026-10-28T00:00:00+00:00',
 window:{trading_days:20,bars:5000,start_utc:'2026-09-30T00:00+00:00',end_utc:'2026-10-27T18:40+00:00'},
 method:{definition:'測試定義',percentile:'nearest-rank',windows_overlap:true,skips:'x'},
 ranges:{
  BUY:{'15m':{status:'AVAILABLE',windows:10,p50_pct:0.1,p95_pct:0.25},'1h':{status:'AVAILABLE',windows:10,p50_pct:0.2,p95_pct:0.5},'4h':{status:'INSUFFICIENT',windows:0}},
  SELL:{'15m':{status:'AVAILABLE',windows:10,p50_pct:0.3,p95_pct:0.6},'1h':{status:'AVAILABLE',windows:10,p50_pct:0.4,p95_pct:0.8},'4h':{status:'AVAILABLE',windows:10,p50_pct:0.5,p95_pct:1}},
 },
};

test('percent of price is applied to the entry price, then to lot size and 100 oz per lot',()=>{
 const r=rangeFor(fake,'BUY','4000','0.10');
 assert.equal(r.status,'AVAILABLE');if(r.status!=='AVAILABLE')return;
 const hour=r.rows.find(x=>x.horizon==='1h')!;
 assert.equal(hour.p95PerOz,'20.00');          // 4000 * 0.5%
 assert.equal(hour.p95Usd,'200.00');           // 20 * 0.10 lot * 100 oz
 assert.equal(hour.p50PerOz,'8.00');assert.equal(hour.p50Usd,'80.00');
});

test('the same percent on a different price level scales with that price',()=>{
 const r=rangeFor(fake,'BUY','2000','1');if(r.status!=='AVAILABLE')throw Error();
 assert.equal(r.rows.find(x=>x.horizon==='1h')!.p95PerOz,'10.00');
 assert.equal(r.rows.find(x=>x.horizon==='1h')!.p95Usd,'1000.00');
});

test('buy and sell use their own side of the snapshot',()=>{
 const buy=rangeFor(fake,'BUY','4000','1'),sell=rangeFor(fake,'SELL','4000','1');
 if(buy.status!=='AVAILABLE'||sell.status!=='AVAILABLE')throw Error();
 assert.notEqual(buy.rows.find(x=>x.horizon==='1h')!.p95PerOz,sell.rows.find(x=>x.horizon==='1h')!.p95PerOz);
 assert.equal(sell.rows.find(x=>x.horizon==='1h')!.p95PerOz,'32.00');
});

test('a horizon without enough data is omitted rather than shown as zero',()=>{
 const r=rangeFor(fake,'BUY','4000','1');if(r.status!=='AVAILABLE')throw Error();
 assert.deepEqual(r.rows.map(x=>x.horizon),['15m','1h']);
});

test('no usable horizon means unavailable with a reason, never an invented range',()=>{
 const empty:Snapshot={...fake,ranges:{BUY:{'15m':{status:'INSUFFICIENT',windows:0}},SELL:{}}};
 const r=rangeFor(empty,'BUY','4000','1');
 assert.equal(r.status,'UNAVAILABLE');
});

test('invalid price or lot is unavailable',()=>{
 for(const [price,lot] of [['0','1'],['-1','1'],['abc','1'],['4000','0'],['4000','x'],['NaN','1'],['4000','Infinity']])
  assert.equal(rangeFor(fake,'BUY',price,lot).status,'UNAVAILABLE',price+'/'+lot);
});

test('the bundled snapshot is complete and ordered: p95 never below p50, windows reported',()=>{
 for(const side of ['BUY','SELL'] as const)for(const h of HORIZONS){
  const r=snapshot.ranges[side][h];
  assert.equal(r.status,'AVAILABLE',side+h);
  assert.ok(r.windows>1000,'windows '+side+h);
  assert.ok(r.p95_pct!>=r.p50_pct!&&r.p50_pct!>=0);
 }
 assert.ok(snapshot.ranges.BUY['4h'].p95_pct!>snapshot.ranges.BUY['15m'].p95_pct!,'longer holding, wider range');
 assert.equal(snapshot.window.trading_days,20);
});

// Same cases as backend/tests/test_volatility.py so the two implementations agree.
test('budget equal to the loss at a lot size is allowed',()=>{
 assert.deepEqual(lotFromBudget('600','3'),{status:'AVAILABLE',lot:'2',lossAtLot:'600.00',capped:false});
});
test('budget floors to the lot step and never exceeds the budget',()=>{
 const r=lotFromBudget('1000','3');
 assert.deepEqual(r,{status:'AVAILABLE',lot:'3.33',lossAtLot:'999.00',capped:false});
});
test('budget below the minimum lot is reported, and the boundary is inclusive',()=>{
 assert.deepEqual(lotFromBudget('2.99','3'),{status:'BELOW_MINIMUM',lossAtMinLot:'3.00'});
 const edge=lotFromBudget('3.00','3');assert.equal(edge.status==='AVAILABLE'&&edge.lot,'0.01');
});
test('budget is capped at the maximum lot and says so',()=>{
 const r=lotFromBudget('1000000','1');
 assert.equal(r.status==='AVAILABLE'&&r.lot,'100');assert.equal(r.status==='AVAILABLE'&&r.capped,true);
});
test('non-positive or non-finite budget input is invalid',()=>{
 for(const [b,p] of [['0','3'],['-5','3'],['abc','3'],['100','0'],['NaN','3'],['Infinity','3']])
  assert.equal(lotFromBudget(b,p).status,'INVALID',b+'/'+p);
});

// Same grid and expectations as backend/tests/test_volatility.py so both languages agree.
const GRID=Array.from({length:100},(_,i)=>Math.round((i+1)*100)/10000);   // 0.01 .. 1.00 percent
const withGrid:Snapshot={...fake,ranges:{
 BUY:Object.fromEntries(['15m','1h','4h'].map(h=>[h,{status:'AVAILABLE',windows:1000,p50_pct:0.2,p95_pct:0.5,quantiles_pct:GRID}])),
 SELL:Object.fromEntries(['15m','1h','4h'].map(h=>[h,{status:'AVAILABLE',windows:1000,p50_pct:0.3,p95_pct:0.8,quantiles_pct:GRID}])),
}};

test('touch share counts grid points at or above the stop, and equal counts as touched',()=>{
 assert.equal(touchShare(GRID,0.505),50);
 assert.equal(touchShare(GRID,0.50),51);
 assert.equal(touchShare(GRID,0.001),100);
 assert.equal(touchShare(GRID,2),0);
});
test('touch share rejects a bad grid or a non-positive stop',()=>{
 assert.throws(()=>touchShare(GRID.slice(0,50),0.5));
 assert.throws(()=>touchShare(GRID,0));
 assert.throws(()=>touchShare(GRID,-1));
 assert.throws(()=>touchShare(GRID,Number.NaN));
});
test('stop distance 20 on price 4000 is 0.5 percent and was reached 51 percent of the time at every horizon',()=>{
 const r=stopTouch(withGrid,'BUY','4000','3980')!;
 assert.equal(r.distancePerOz,'20.00');
 assert.deepEqual(r.rows.map(x=>x.sharePct),[51,51,51]);
});
test('no stop, equal stop, unreadable stop or missing grid give no stop block',()=>{
 assert.equal(stopTouch(withGrid,'BUY','4000',null),null);
 assert.equal(stopTouch(withGrid,'BUY','4000','4000'),null);
 assert.equal(stopTouch(withGrid,'BUY','4000','abc'),null);
 assert.equal(stopTouch(withGrid,'BUY','abc','3980'),null);
 assert.equal(stopTouch(fake,'BUY','4000','3980'),null);      // fake has no quantile grid
});
test('a stop far beyond anything in the window was never reached; a tight stop is reached almost always',()=>{
 assert.equal(stopTouch(withGrid,'BUY','4000','3800')!.rows[0].sharePct,0);       // 5 percent away
 assert.equal(stopTouch(withGrid,'BUY','4000','3999.9')!.rows[0].sharePct,100);   // 0.0025 percent away
});
test('wider stops are never reached more often than tighter ones in the bundled snapshot',()=>{
 for(const side of ['BUY','SELL'] as const){
  const tight=stopTouch(snapshot,side,'4000','3990')!,wide=stopTouch(snapshot,side,'4000','3900')!;
  tight.rows.forEach((t,i)=>assert.ok(wide.rows[i].sharePct<=t.sharePct,side+t.horizon));
  const rows=tight.rows.map(r=>r.sharePct);          // longer holding reaches the same stop at least as often
  assert.ok(rows[0]<=rows[1]&&rows[1]<=rows[2],side+' '+rows.join(','));
 }
});
