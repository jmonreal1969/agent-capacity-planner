import assert from 'node:assert/strict';import {defaults,metrics,solve,dayStats,validate,migrateLegacy} from './model.js';
const c=structuredClone(defaults),v={agents:80,support:8,shrink:20,aht:300,acw:5400,calls:60};
let m=metrics(v,c);assert.equal(m.productive,25200);assert.equal(m.available,60);assert.equal(m.activePer,84);assert.equal(m.per,63);assert.equal(m.capacity,5040);
assert.equal(metrics({...v,shrink:0},c).capacity,6720);assert.equal(metrics({...v,acw:0},c).capacity,6120);assert.equal(metrics({...v,acw:10800},c).capacity,3960);
assert.equal(metrics({...v,agents:0},c).capacity,0);assert.equal(metrics({...v,agents:0},c).per,0);assert.equal(metrics({...v,shrink:90},c).capacity,0);
assert.equal(metrics({...v,acw:40000},c).productive,0);assert.equal(metrics({...v,aht:0},c).valid,false);assert.equal(metrics(v,{...c,contribution:50}).capacity,5376);
assert.deepEqual(dayStats(7500,m),{answered:5040,shortfall:2460,percent:32.800000000000004,coverage:67.2});assert.equal(dayStats(0,m).percent,0);
let r=solve(v,c,60,4800,'aht');assert.equal(r.values.agents,80);assert.equal(r.values.aht,315);assert.equal(metrics(r.values,c).capacity,4800);assert.equal(metrics(r.values,c).per,60);
r=solve(v,c,60,4800,'acw');assert.equal(r.values.agents,80);assert.equal(r.values.acw,6600);assert.equal(metrics(r.values,c).capacity,4800);
r=solve(v,c,60,4800,'shrink');assert.ok(metrics(r.values,c).capacity>=4800);assert.ok(Math.abs(metrics(r.values,c).per-60)<1);assert.equal(r.values.aht,v.aht);assert.equal(r.values.acw,v.acw);
r=solve(v,c,150,20000,'aht');assert.ok(metrics(r.values,c).capacity<20000);assert.ok(r.issues.length>0);
r=solve(v,c,60,0,'aht');assert.equal(r.values.agents,0);assert.equal(metrics(r.values,c).capacity,0);
for(const field of ['aht','acw','shrink'])for(const target of [0,1,60,150]){r=solve(v,c,target,1000,field);for(const k of ['agents','support','shrink','aht','acw'])assert.ok(Number.isFinite(r.values[k]));}
validate(c);assert.throws(()=>validate({...c,acwLimit:200}));assert.throws(()=>validate({...c,shift:0}));assert.throws(()=>validate({...c,days:[-1,0,0,0,0]}));
const old=structuredClone(c);delete old.acwLimit;old.limits.shrink=[0,100,1,25];old.limits.acw=[0,3000,1,60];const migrated=migrateLegacy({config:old,values:{...v,shrink:25,acw:60}});
assert.equal(migrated.values.shrink,20);assert.equal(migrated.values.acw,5100);assert.equal(migrated.config.limits.shrink[1],50);assert.equal(migrated.config.limits.acw[1],10800);assert.equal(metrics(migrated.values,migrated.config).capacity,5100);
console.log('Capacity v2 checks passed: unavailable headcount, daily ACW, reverse planning, limits, and legacy conversion.');