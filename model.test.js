import assert from 'node:assert/strict';import {defaults,metrics,solve,dayStats,validate,migrateLegacy,upgradeSupportConfig,upgradeBenchmarks} from './model.js';
const c={...structuredClone(defaults),contribution:0},v={agents:80,support:8,shrink:20,aht:300,acw:5400,calls:60};
let m=metrics(v,c);assert.equal(m.productive,25200);assert.equal(m.available,60);assert.equal(m.activePer,84);assert.equal(m.per,84);assert.equal(m.capacity,5040);
assert.equal(metrics({...v,shrink:0},c).capacity,6720);assert.equal(metrics({...v,acw:0},c).capacity,6120);assert.equal(metrics({...v,acw:10800},c).capacity,3960);
assert.equal(metrics({...v,agents:0},c).capacity,0);assert.equal(metrics({...v,agents:0},c).per,84);assert.equal(metrics({...v,shrink:90},c).capacity,0);
assert.equal(metrics({...v,acw:40000},c).productive,0);assert.equal(metrics({...v,aht:0},c).valid,false);assert.equal(metrics(v,{...c,contribution:50}).capacity,5376);
assert.deepEqual(dayStats(7500,m),{answered:5040,shortfall:2460,percent:32.800000000000004,coverage:67.2});assert.equal(dayStats(0,m).percent,0);
let r=solve(v,c,60,4800,'aht');assert.equal(r.values.agents,100);assert.equal(r.values.aht,420);assert.equal(metrics(r.values,c).capacity,4800);assert.equal(metrics(r.values,c).per,60);
r=solve(v,c,80,4800,'acw');assert.equal(r.values.agents,80);assert.equal(r.values.acw,6600);assert.equal(metrics(r.values,c).capacity,4800);
r=solve(v,c,60,4800,'shrink');assert.ok(metrics(r.values,c).capacity>=4800);assert.ok(Math.abs(metrics(r.values,c).per-60)<1);assert.equal(r.values.shrink,v.shrink);assert.equal(r.values.acw,v.acw);
r=solve(v,c,150,30000,'aht');assert.ok(metrics(r.values,c).capacity<30000);assert.ok(r.issues.length>0);
r=solve(v,c,60,0,'aht');assert.equal(r.values.agents,0);assert.equal(metrics(r.values,c).capacity,0);
for(const field of ['aht','acw','shrink'])for(const target of [0,1,60,150]){r=solve(v,c,target,1000,field);for(const k of ['agents','support','shrink','aht','acw'])assert.ok(Number.isFinite(r.values[k]));}
validate(c);assert.throws(()=>validate({...c,acwLimit:200}));assert.throws(()=>validate({...c,shift:0}));assert.throws(()=>validate({...c,days:[-1,0,0,0,0]}));
const old=structuredClone(c);delete old.acwLimit;old.limits.shrink=[0,100,1,25];old.limits.acw=[0,3000,1,60];const migrated=migrateLegacy({config:old,values:{...v,shrink:25,acw:60}});
assert.equal(migrated.values.shrink,20);assert.equal(migrated.values.acw,5100);assert.equal(migrated.config.limits.shrink[1],50);assert.equal(migrated.config.limits.acw[1],10800);assert.equal(metrics(migrated.values,migrated.config).capacity,5100);
console.log('Capacity v2 checks passed: unavailable headcount, daily ACW, reverse planning, limits, and legacy conversion.');
assert.equal(defaults.contribution,100);const reserveConfig=structuredClone(defaults);assert.equal(metrics(v,reserveConfig).capacity,5712);assert.equal(metrics({...v,support:0},reserveConfig).capacity,5040);assert.equal(metrics({...v,support:1},reserveConfig).capacity,5124);assert.equal(metrics({...v,agents:0,shrink:0,support:8},reserveConfig).capacity,672);
const legacySupport={...reserveConfig,contribution:0};delete legacySupport.supportModelVersion;const upgraded=upgradeSupportConfig(legacySupport);assert.equal(upgraded.contribution,100);assert.equal(legacySupport.contribution,0);assert.equal(upgradeSupportConfig({...legacySupport,contribution:50}).contribution,50);assert.equal(upgradeSupportConfig({...reserveConfig,contribution:0}).contribution,0);
const noReserveSolution=solve(v,c,60,4800,'aht'),reserveSolution=solve(v,reserveConfig,60,4800,'aht');assert.ok(reserveSolution.values.agents<noReserveSolution.values.agents);assert.ok(metrics(reserveSolution.values,reserveConfig).capacity>=4800);
console.log('Reserve support checks passed: full contribution, additional capacity, reserve-only coverage, saved config upgrade, explicit overrides, and reverse staffing.');
const reserveMetrics=metrics(v,reserveConfig);assert.equal(reserveMetrics.per,84);assert.equal(reserveMetrics.per,metrics({...v,support:0},reserveConfig).per);assert.equal(metrics({...v,agents:0,shrink:0,support:8},reserveConfig).per,84);
const fullPoolSolve=solve(v,reserveConfig,60,4800,'aht');assert.ok(Math.abs(metrics(fullPoolSolve.values,reserveConfig).per-60)<.2);

assert.equal(upgradeSupportConfig({...defaults,supportModelVersion:1,contribution:0}).contribution,100);

assert.equal(defaults.limits.agents[3],121);
assert.deepEqual(defaults.benchmarks,{agents:121,acwGoal:5400,acwCurrent:7200,ahtGoal:300,ahtCurrent:330});
const preBenchmarks=structuredClone(defaults);delete preBenchmarks.benchmarks;delete preBenchmarks.benchmarkVersion;preBenchmarks.limits.agents[3]=80;
const withBenchmarks=upgradeBenchmarks(preBenchmarks);validate(withBenchmarks);assert.equal(withBenchmarks.limits.agents[3],121);assert.equal(preBenchmarks.limits.agents[3],80);
const custom=structuredClone(defaults);custom.benchmarks.agents=117;custom.limits.agents[3]=117;custom.benchmarks.ahtCurrent=320;validate(custom);assert.equal(upgradeBenchmarks(custom),custom);
assert.throws(()=>validate({...custom,benchmarks:{...custom.benchmarks,ahtCurrent:601}}));
assert.throws(()=>validate({...custom,benchmarks:{...custom.benchmarks,agents:120}}));
const offStep=structuredClone(custom);offStep.limits.aht[2]=5;offStep.benchmarks.ahtCurrent=321;assert.throws(()=>validate(offStep));
console.log('Editable benchmark defaults, upgrade, custom preservation, range and step validation passed.');
