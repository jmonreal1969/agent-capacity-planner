import test from 'node:test';
import assert from 'node:assert/strict';
import {sourceRoster,sourceCalls} from './interval-data.js';
import {intervalDefaults,intervalInitial,validateIntervalConfig,validateIntervalState,validateRoster,coverage,agentsNeeded,recommendBreakMove,shortageHours} from './interval-model.js';
import {queueStats} from './campaign-model.js';
import {sealSettings,openSettings,validateSharedSettings} from './auth-access.js';
import {defaults} from './model.js';
import {campaignDefaults} from './campaign-model.js';
test('119 source shifts reconcile and working days differ correctly',()=>{
 assert.equal(sourceRoster.length,119);assert.equal(sourceRoster.filter(r=>r[6]===30).length,51);sourceRoster.forEach(validateRoster);
 assert.deepEqual([0,1,2,3,4].map(day=>coverage({...intervalInitial(),day}).scheduled),[119,119,116,111,110]);
 assert.deepEqual(sourceCalls.reduce((a,r)=>a.map((n,i)=>n+r[i]),[0,0,0,0,0]).map(n=>Math.round(n*100)/100),[10779,9462.2,8236.8,7850,6963.75]);
});
test('Friday shrinkage includes scheduled-off agents once, not twice',()=>{
 const r=coverage({...intervalInitial(),day:4,unavailable:32});assert.equal(r.off,9);assert.equal(r.extra,23);assert.equal(r.present,87);
 assert.ok(Math.abs(r.rows.reduce((n,x)=>n+x.available*30,0)-87*400)<1e-7);
 for(const x of r.rows)assert.ok(Math.abs(x.onShift-x.absence-x.lunch-x.breaks-x.wrap-x.available)<1e-8);
 assert.equal(coverage({...intervalInitial(),day:4,unavailable:0}).present,110);
 assert.equal(coverage({...intervalInitial(),day:4,unavailable:119}).present,0);
});
test('both shift groups retain 400 call minutes, lunch and partial breaks are placed exactly',()=>{
 for(const id of [0,51]){const s=intervalInitial();s.day=0;s.exact=true;s.absent=sourceRoster.map((_,i)=>i).filter(i=>i!==id);const r=coverage(s);assert.equal(r.present,1);assert.ok(Math.abs(r.rows.reduce((n,x)=>n+x.available*30,0)-400)<1e-8);assert.ok(Math.abs(r.rows.reduce((n,x)=>n+x.lunch*30,0)-sourceRoster[id][6])<1e-8);assert.ok(Math.abs(r.rows.reduce((n,x)=>n+x.breaks*30,0)-30)<1e-8);assert.ok(Math.abs(r.rows.reduce((n,x)=>n+x.wrap*30,0)-50)<1e-8);}
 const s=intervalInitial();s.day=0;s.exact=true;s.absent=sourceRoster.map((_,i)=>i).filter(i=>i!==1);assert.ok(Math.abs(coverage(s).rows[3].breaks-.5)<1e-9);
});
test('named absences ignore agents already off',()=>{
 const s={...intervalInitial(),day:4,exact:true,absent:[0,35,36]};const r=coverage(s);assert.equal(r.extra,1);assert.equal(r.present,109);assert.equal(r.unavailable,10);
});
test('minimum active coverage meets all goals and one fewer fails',()=>{
 const n=agentsNeeded(746,286,intervalDefaults);assert.equal(n,123);
 const meets=m=>{const r=queueStats({arrivalRate:746/1800,aht:286,patience:90,agents:m,serviceSeconds:120});return r.service>=.75&&r.abandon<=.03&&r.wait<=120;};assert.ok(meets(n));assert.ok(!meets(n-1));assert.equal(agentsNeeded(0,338,intervalDefaults),0);
});
test('proposals preserve source, redistribute coverage, and safe suggestion reduces shortage',()=>{
 const s={...intervalInitial(),day:0,unavailable:0,aht:286};const original=JSON.stringify(sourceRoster),before=coverage(s,'current');s.proposed={0:[540,840,870]};const after=coverage(s,'proposed');assert.ok(Math.abs(before.rows.reduce((n,r)=>n+r.available,0)-after.rows.reduce((n,r)=>n+r.available,0))<1e-8);assert.equal(JSON.stringify(sourceRoster),original);
 s.proposed={};const move=recommendBreakMove(s);assert.ok(move);s.proposed[move.agent]=move.times;const proposal=coverage(s,'proposed');assert.ok(shortageHours(proposal.rows)<shortageHours(before.rows));proposal.rows.forEach((r,i)=>assert.ok(Math.max(0,-r.gap)<=Math.max(0,-before.rows[i].gap)+1e-7));
});
test('reject invalid schedules and malformed backups; zero demand needs no agents',()=>{
 const r=structuredClone(sourceRoster[0]);r[5]=r[4];assert.throws(()=>validateRoster(r));r[5]=2000;assert.throws(()=>validateRoster(r));
 assert.throws(()=>validateIntervalConfig({...intervalDefaults,calls:{'24:0':1}}));assert.throws(()=>validateIntervalState({...intervalInitial(),proposed:{'999':[0,1,2]}}));assert.throws(()=>validateIntervalState({...intervalInitial(),aht:0}));
 const state=intervalInitial();state.config.calls['0:0']=0;state.day=0;assert.equal(coverage(state).rows[0].needed,0);
 assert.deepEqual(validateIntervalState(state),state);
});
test('Supervisor snapshots preserve interval settings and remain within cookie limit',()=>{
 const interval=structuredClone(intervalDefaults);interval.roster[0]=structuredClone(sourceRoster[0]);interval.roster[0][5]=840;interval.calls['0:0']=50;
 const settings=validateSharedSettings({version:1,agent:defaults,campaign:campaignDefaults,interval});const secret='interval-test-secret';const token=sealSettings(settings,secret);assert.ok(token.length<3400);assert.deepEqual(openSettings(token,secret).interval,interval);
 assert.equal(openSettings(token+'x',secret),null);
});
