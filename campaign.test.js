import assert from 'node:assert/strict';
import {campaignDefaults,campaignInitial,validateCampaignState,campaignCounts,queueStats,planCampaign,scaleCampaignDemand,campaignStaffingBattery,campaignOutcomes,campaignAhtForCalls,campaignStaffingValues} from './campaign-model.js';
import {defaults} from './model.js';
const near=(a,b,tol=1e-10)=>assert.ok(Math.abs(a-b)<tol, a+' ≠ '+b);
assert.deepEqual(campaignCounts(7500,8),{queued:7500,abandoned:600,handled:6900});
assert.deepEqual(campaignCounts(3,50),{queued:3,abandoned:2,handled:1});
assert.deepEqual(campaignCounts(0,8),{queued:0,abandoned:0,handled:0});
validateCampaignState(campaignInitial());
assert.throws(()=>validateCampaignState({...campaignInitial(),day:5}));
assert.throws(()=>validateCampaignState({...campaignInitial(),values:{...campaignInitial().values,patience:0}}));
const q=queueStats({arrivalRate:1,aht:1,patience:1,agents:1,serviceSeconds:0});
near(q.served,1-Math.exp(-1));near(q.abandon,Math.exp(-1));near(q.service,Math.exp(-1));near(q.served+q.abandon,1);near(q.queue,q.abandon);
const long=queueStats({arrivalRate:1,aht:1,patience:1,agents:1,serviceSeconds:100});near(long.service,long.served);
for(const n of [1,2,10,78,120]){
 const s=queueStats({arrivalRate:.25,aht:330,patience:90,agents:n,serviceSeconds:120});
 near(s.served+s.abandon,1,1e-9);assert(s.service<=s.served+1e-12);assert(s.wait>=0);assert(s.abandonWait>=0);assert(s.occupancy>=0&&s.occupancy<=1);
 near(s.wait*s.served+s.abandonWait*s.abandon,s.queue/.25,1e-8);
}
const shared={agentConfig:structuredClone(defaults),agentValues:{agents:121,support:0,shrink:0,acw:7200}};
const args={queued:7500,aht:330,config:structuredClone(campaignDefaults),values:campaignInitial().values,...shared};
const base=planCampaign(args);
assert(base.feasible);assert.equal(base.active,78);assert.equal(base.headcount,102);
assert(base.stats.abandon<=.08);assert(base.stats.wait<=120);assert(base.stats.service>=.77);
const previous=queueStats({arrivalRate:7500/30600,aht:330,patience:90,agents:base.active-1,serviceSeconds:120});assert(previous.abandon>.08||previous.wait>120||previous.service<.77);
assert(planCampaign({...args,queued:10000}).headcount>base.headcount);
assert(planCampaign({...args,aht:360}).headcount>=base.headcount);
assert(planCampaign({...args,values:{...args.values,abandonRate:2}}).headcount>=base.headcount);
assert(planCampaign({...args,values:{...args.values,waitTarget:1}}).headcount>=base.headcount);
assert(planCampaign({...args,values:{...args.values,serviceTarget:99}}).headcount>=base.headcount);
assert.equal(planCampaign({...args,agentValues:{...shared.agentValues,shrink:10}}).headcount,base.headcount+10);
assert.equal(planCampaign({...args,agentValues:{...shared.agentValues,support:10}}).headcount,base.headcount-10);
assert(planCampaign({...args,agentValues:{...shared.agentValues,acw:5400}}).headcount<=base.headcount);
assert.equal(planCampaign({...args,queued:0}).headcount,0);
assert.equal(planCampaign({...args,config:{...args.config,maxAgents:1}}).feasible,false);
assert.equal(planCampaign({...args,agentValues:{...shared.agentValues,acw:30600}}).feasible,false);
// Independent seeded event simulation validates served-only wait and service-level CDF.
function simulate({lambda,aht,patience,agents,T},seed=123456){
 const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return (seed+.5)/4294967296;},exp=mean=>-Math.log(random())*mean;
 const heap=[],push=e=>{heap.push(e);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].t<=e.t)break;heap[i]=heap[p];i=p;}heap[i]=e;},pop=()=>{const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let j=i*2+1;if(j+1<heap.length&&heap[j+1].t<heap[j].t)j++;if(last.t<=heap[j].t)break;heap[i]=heap[j];i=j;}heap[i]=last;}return first;};
 let arrived=0,busy=0,head=0,served=0,abandoned=0,within=0,wait=0;const waiting=[],warm=10000,total=160000;
 const start=(j,t)=>{j.state='served';busy++;if(j.measured){served++;wait+=t-j.at;if(t-j.at<=T)within++;}push({t:t+exp(aht),kind:'end'});};
 push({t:exp(1/lambda),kind:'arrival'});
 while(heap.length){const e=pop();if(e.kind==='arrival'){arrived++;const j={at:e.t,state:'waiting',measured:arrived>warm};if(busy<agents)start(j,e.t);else{waiting.push(j);push({t:e.t+exp(patience),kind:'abandon',j});}if(arrived<total)push({t:e.t+exp(1/lambda),kind:'arrival'});}
 else if(e.kind==='abandon'){if(e.j.state==='waiting'){e.j.state='abandoned';if(e.j.measured)abandoned++;}}
 else{busy--;while(head<waiting.length&&waiting[head].state!=='waiting')head++;if(head<waiting.length)start(waiting[head++],e.t);}}
 return {abandon:abandoned/(total-warm),service:within/(total-warm),wait:wait/served};
}
for(const cfg of [{lambda:1,aht:1,patience:1,agents:1,T:.5},{lambda:7500/30600,aht:330,patience:90,agents:78,T:5}]){
 const exact=queueStats({arrivalRate:cfg.lambda,aht:cfg.aht,patience:cfg.patience,agents:cfg.agents,serviceSeconds:cfg.T}),sim=simulate(cfg);
 near(exact.abandon,sim.abandon,.006);near(exact.service,sim.service,.008);near(exact.wait,sim.wait,cfg.aht===1?.008:.45);
}
console.log('Campaign checks passed: flow balance, analytic cases, independent queue simulation, minimal staffing, linked totals, constraints and edge cases.');


assert.deepEqual(scaleCampaignDemand([7500,6800,6500,6200,5500],0,9000,15000),[9000,8160,7800,7440,6600]);
assert.deepEqual(scaleCampaignDemand([0,0,0,0,0],0,1000,15000),[1000,1000,1000,1000,1000]);
assert.deepEqual(scaleCampaignDemand([7500,6800,6500,6200,5500],0,0,15000),[0,0,0,0,0]);
assert.deepEqual(scaleCampaignDemand([7500,6800,6500,6200,5500],4,15000,15000),[15000,15000,15000,15000,15000]);
const coveredBattery=campaignStaffingBattery(102,121);near(coveredBattery.green,102/121);assert.equal(coveredBattery.red,0);assert.equal(coveredBattery.spare,19);
assert(campaignStaffingBattery(90,121).green<coveredBattery.green);
const gapBattery=campaignStaffingBattery(102,50);near(gapBattery.green,50/102);near(gapBattery.red,52/102);assert.equal(gapBattery.additional,52);
assert.equal(campaignStaffingBattery(0,121).empty,true);assert.equal(campaignStaffingBattery(null,121).empty,true);assert.equal(campaignStaffingBattery(100,0).red,1);
console.log('Week-wide demand scaling and responsive staffing battery checks passed.');

assert.deepEqual(campaignDefaults.limits.abandonRate,[0,20,.1,8]);
const oldPercent=campaignInitial();delete oldPercent.config.abandonRangeVersion;oldPercent.config.limits.abandonRate=[0,100,.1,35];oldPercent.values.abandonRate=40;
const newPercent=validateCampaignState(oldPercent);assert.deepEqual(newPercent.config.limits.abandonRate,[0,20,.1,20]);assert.equal(newPercent.values.abandonRate,20);assert.equal(oldPercent.values.abandonRate,40);
const editedPercent=structuredClone(newPercent);editedPercent.config.limits.abandonRate=[0,15,.1,3];editedPercent.values.abandonRate=3;assert.deepEqual(validateCampaignState(editedPercent),editedPercent);
console.log('Abandonment defaults and saved ranges migrate to 0–20% once; later Admin edits persist.');

const oldBenchmarks=campaignInitial();delete oldBenchmarks.config.benchmarks;const migratedBenchmarks=validateCampaignState(oldBenchmarks);assert.deepEqual(migratedBenchmarks.config.benchmarks,{serviceTarget:75,abandonRate:3});assert.equal(oldBenchmarks.config.benchmarks,undefined);
const customBenchmarks=structuredClone(migratedBenchmarks);customBenchmarks.config.benchmarks={serviceTarget:80,abandonRate:2};assert.deepEqual(validateCampaignState(customBenchmarks).config.benchmarks,customBenchmarks.config.benchmarks);assert.throws(()=>validateCampaignState({...customBenchmarks,config:{...customBenchmarks.config,benchmarks:{serviceTarget:-1,abandonRate:3}}}));
console.log('Campaign goal benchmarks migrate, preserve Admin edits and reject invalid backups.');

const driverPlan=planCampaign(args);assert.equal(driverPlan.active,Math.max(...Object.values(driverPlan.requirements).map(r=>r.active)));assert.deepEqual(driverPlan.drivers,['abandonRate']);assert.equal(driverPlan.allMet,true);
for(const focus of ['abandonRate','waitTarget','serviceTarget']){const p=planCampaign({...args,focus});assert.equal(p.active,p.requirements[focus].active);assert.equal(p.goalStatus[focus],true);assert.deepEqual(p.drivers,[focus]);assert.ok(p.headcount<=driverPlan.headcount);if(p.active>1){const prev=queueStats({arrivalRate:args.queued/(args.config.openHours*3600),aht:args.aht,patience:args.values.patience,agents:p.active-1,serviceSeconds:args.config.serviceSeconds});assert.ok(focus==='abandonRate'?prev.abandon>args.values.abandonRate/100:focus==='waitTarget'?prev.wait>args.values.waitTarget:prev.service<args.values.serviceTarget/100);}}
const serviceOnly=planCampaign({...args,focus:'serviceTarget'});assert.equal(serviceOnly.goalStatus.abandonRate,false);assert.equal(serviceOnly.allMet,false);
const lowService=planCampaign({...args,focus:'serviceTarget',values:{...args.values,serviceTarget:60}}),highService=planCampaign({...args,focus:'serviceTarget',values:{...args.values,serviceTarget:85}});assert.ok(highService.headcount>lowService.headcount);
const limitedArgs={...args,config:{...args.config,maxAgents:75},values:{...args.values,abandonRate:0,serviceTarget:50},focus:'serviceTarget'};assert.equal(planCampaign(limitedArgs).feasible,true);assert.equal(planCampaign({...limitedArgs,focus:'all'}).feasible,false);
assert.equal(planCampaign({...args,queued:0,focus:'serviceTarget'}).headcount,0);
const legacyFocus=campaignInitial();delete legacyFocus.focus;assert.equal(validateCampaignState(legacyFocus).focus,'all');assert.throws(()=>validateCampaignState({...campaignInitial(),focus:'unknown'}));
console.log('Per-target minimum staffing, combined drivers, unmet goals, single-target sensitivity, infeasible combinations and saved planning mode passed.');

const forwardArgs={queued:7500,aht:300,config:structuredClone(campaignDefaults),values:campaignInitial().values,agentConfig:structuredClone(defaults),agentValues:{agents:121,support:0,shrink:0,acw:5400}};
const sweet=campaignOutcomes(forwardArgs);assert.equal(sweet.per,84);assert.equal(sweet.capacity,10164);assert.equal(sweet.handled+sweet.abandoned,7500);assert.ok(sweet.handled<=sweet.capacity);assert.ok(sweet.service<=sweet.handled/sweet.queued*100+1e-9);
const fewer=campaignOutcomes({...forwardArgs,agentValues:{...forwardArgs.agentValues,agents:65}}),slow=campaignOutcomes({...forwardArgs,aht:360}),moreAcw=campaignOutcomes({...forwardArgs,agentValues:{...forwardArgs.agentValues,acw:9000}});
for(const p of [fewer,slow,moreAcw]){assert.ok(p.handled<=sweet.handled);assert.ok(p.abandonRate>=sweet.abandonRate);assert.ok(p.service<=sweet.service);assert.ok(p.capacity<sweet.capacity);assert.equal(p.handled+p.abandoned,p.queued);}
const none=campaignOutcomes({...forwardArgs,agentValues:{...forwardArgs.agentValues,agents:0}});assert.equal(none.handled,0);assert.equal(none.abandoned,7500);assert.equal(none.service,0);assert.equal(none.wait,null);assert.equal(none.goalStatus.waitTarget,false);
const zero=campaignOutcomes({...forwardArgs,queued:0});assert.equal(zero.handled,0);assert.equal(zero.abandoned,0);assert.equal(zero.wait,null);assert.equal(zero.service,null);assert.equal(zero.goalStatus,null);
const noTime=campaignOutcomes({...forwardArgs,agentValues:{...forwardArgs.agentValues,acw:30600}});assert.equal(noTime.handled,0);assert.equal(noTime.capacity,0);
const link=campaignAhtForCalls(84,5400,defaults);assert.equal(link.aht,300);assert.equal(link.actual,84);assert.equal(link.limited,false);assert.equal(campaignAhtForCalls(0,5400,defaults).valid,false);assert.equal(campaignAhtForCalls(150,5400,defaults).limited,true);
const otherGoals=campaignOutcomes({...forwardArgs,config:{...forwardArgs.config,benchmarks:{abandonRate:0,serviceTarget:100}}});assert.equal(otherGoals.handled,sweet.handled);assert.equal(otherGoals.service,sweet.service);
const reserveForward=campaignOutcomes({...forwardArgs,agentValues:{...forwardArgs.agentValues,support:10}});assert.ok(reserveForward.capacity>sweet.capacity);assert.ok(reserveForward.service>=sweet.service);
const allUnavailable=campaignOutcomes({...forwardArgs,agentValues:{...forwardArgs.agentValues,shrink:121}});assert.equal(allUnavailable.handled,0);
assert.equal(campaignOutcomes({...forwardArgs,aht:0}).valid,false);
const oldCallsGoal=campaignInitial();delete oldCallsGoal.config.callsBenchmark;assert.equal(validateCampaignState(oldCallsGoal).config.callsBenchmark,85);
console.log('Forward Campaign outcomes: sweet spot, staffing/productivity sensitivity, reconciled counts, goal independence, zero demand/staff/time, reserve support and linked calls control passed.');

const oldTemporaryPatience=campaignInitial();delete oldTemporaryPatience.config.queueAssumptionsVersion;oldTemporaryPatience.values.patience=1;oldTemporaryPatience.config.limits.patience[3]=90;const restoredPatience=validateCampaignState(oldTemporaryPatience);assert.equal(restoredPatience.values.patience,90);assert.equal(oldTemporaryPatience.values.patience,1);assert.equal(restoredPatience.config.queueAssumptionsVersion,1);
const explicitShortPatience=structuredClone(oldTemporaryPatience);explicitShortPatience.config.limits.patience[3]=1;assert.equal(validateCampaignState(explicitShortPatience).values.patience,1);
const laterAssumption=structuredClone(restoredPatience);laterAssumption.values.patience=100;laterAssumption.config.limits.patience[3]=100;assert.equal(validateCampaignState(laterAssumption).values.patience,100);
const screenshotArgs={...forwardArgs,queued:10452,aht:338,agentValues:{agents:121,support:0,shrink:0,acw:7200}};
const screenshotOld=campaignOutcomes({...screenshotArgs,values:{...forwardArgs.values,patience:1}}),screenshotFixed=campaignOutcomes({...screenshotArgs,values:{...forwardArgs.values,patience:90}});
assert.equal(screenshotOld.handled,8076);assert.equal(screenshotOld.abandoned,2376);assert.equal(screenshotOld.wait.toFixed(1),'0.1');assert.equal(screenshotFixed.wait.toFixed(1),'19.4');
const lowerHc=campaignOutcomes({...screenshotArgs,agentValues:{...screenshotArgs.agentValues,agents:80}}),higherAht=campaignOutcomes({...screenshotArgs,aht:360}),higherAcw=campaignOutcomes({...screenshotArgs,agentValues:{...screenshotArgs.agentValues,acw:9000}});
assert.ok(lowerHc.wait>screenshotFixed.wait+20);assert.ok(higherAht.wait>screenshotFixed.wait);assert.ok(higherAcw.wait>screenshotFixed.wait);
console.log('Legacy one-second patience scenario uses Admin default once; explicit assumptions persist; screenshot reproduced and wait reacts to staffing, AHT and ACW.');

assert.equal(campaignDefaults.headcountMax,175);assert.deepEqual(campaignStaffingValues({agents:121,support:20,shrink:5},175),{agents:155,support:20,shrink:5});assert.deepEqual(campaignStaffingValues({agents:121,support:20,shrink:5},10),{agents:0,support:10,shrink:5});const combined=campaignStaffingValues({agents:121,support:20,shrink:0,acw:5400},175);const combinedResult=campaignOutcomes({...forwardArgs,agentValues:combined});assert.equal(combinedResult.capacity,175*84);assert.equal(defaults.limits.agents[1],150);assert.equal(defaults.limits.support[1],60);
const oldCombined=campaignInitial();delete oldCombined.config.headcountMax;delete oldCombined.headcount;assert.equal(validateCampaignState(oldCombined).config.headcountMax,175);assert.equal(validateCampaignState(oldCombined).headcount,null);assert.equal(validateCampaignState({...campaignInitial(),headcount:175}).headcount,175);assert.throws(()=>validateCampaignState({...campaignInitial(),headcount:176}));
console.log('Campaign-only maximum175, combined support counted once, shared Agent limits unchanged, saved staffing and backup validation passed.');

assert.equal(campaignDefaults.callsCurrentBenchmark,69.2);const oldCurrentCalls=campaignInitial();delete oldCurrentCalls.config.callsCurrentBenchmark;assert.equal(validateCampaignState(oldCurrentCalls).config.callsCurrentBenchmark,69.2);const editedCurrentCalls=campaignInitial();editedCurrentCalls.config.callsCurrentBenchmark=70.5;assert.equal(validateCampaignState(editedCurrentCalls).config.callsCurrentBenchmark,70.5);const currentCallsLink=campaignAhtForCalls(69.2,7200,defaults);assert.equal(currentCallsLink.aht,338);assert.equal(currentCallsLink.actual.toFixed(1),'69.2');console.log('Campaign red current calls benchmark migrates, preserves edits, and links 69.2 to 5:38 AHT at 120-minute ACW.');

const previousCallsGoal=campaignInitial();delete previousCallsGoal.config.performanceGoalsVersion;previousCallsGoal.config.callsBenchmark=84;const revisedCallsGoal=validateCampaignState(previousCallsGoal);assert.equal(revisedCallsGoal.config.callsBenchmark,85);assert.equal(previousCallsGoal.config.callsBenchmark,84);const laterCallsGoal=structuredClone(revisedCallsGoal);laterCallsGoal.config.callsBenchmark=86;assert.equal(validateCampaignState(laterCallsGoal).config.callsBenchmark,86);const newGoalLink=campaignAhtForCalls(85,6300,defaults);assert.equal(newGoalLink.aht,286);assert.ok(Math.abs(newGoalLink.actual-85)<.05);console.log('Campaign calls goal85 migrates once and corresponds to AHT4:46 with dailyACW105.');
