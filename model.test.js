import assert from 'node:assert/strict';import {defaults,metrics,solve,dayStats,validate} from './model.js';
const c=structuredClone(defaults),v={agents:80,support:8,shrink:25,aht:300,acw:60,calls:60};
const m=metrics(v,c);assert.equal(m.per,63.75);assert.equal(m.capacity,5100);assert.equal(m.productive,22950);
assert.deepEqual(dayStats(7500,m),{answered:5100,shortfall:2400,percent:32,coverage:68});
assert.equal(metrics({...v,agents:0},c).capacity,0);assert.equal(metrics({...v,shrink:100},c).capacity,0);
assert.equal(metrics({...v,aht:0,acw:0},c).valid,false);assert.equal(dayStats(0,m).percent,0);
assert.equal(metrics(v,{...c,contribution:50}).capacity,5355);
let r=solve(v,c,60,5900,'aht');assert.equal(r.values.aht,323);assert.equal(r.values.agents,99);assert.equal(r.values.support,10);assert.ok(metrics(r.values,c).capacity>=5900);
r=solve(v,c,0,6000,'aht');assert.ok(r.issues.length>0);assert.ok(Number.isFinite(metrics(r.values,c).capacity));
r=solve(v,c,150,20000,'aht');assert.ok(metrics(r.values,c).capacity<20000);assert.ok(r.issues.length>0);
assert.throws(()=>validate({...c,shift:0}));assert.throws(()=>validate({...c,contribution:101}));assert.throws(()=>validate({...c,days:[-1,0,0,0,0]}));
for(const field of ['aht','acw','shrink'])for(const target of [0,1,60,150]){r=solve(v,c,target,1000,field);for(const k of ['agents','support','shrink','aht','acw'])assert.ok(Number.isFinite(r.values[k]));}
console.log('Capacity model checks passed');