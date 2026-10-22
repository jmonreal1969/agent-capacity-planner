// Erlang A: Poisson arrivals, exponential service/patience, one FCFS queue.
// Source model: Garnett, Mandelbaum & Reiman (2002), Designing a Call Center
// with Impatient Customers. All rates below use seconds.
const copy=x=>JSON.parse(JSON.stringify(x));
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const campaignDefaults={version:1,queueAssumptionsVersion:1,abandonRangeVersion:1,benchmarks:{serviceTarget:75,abandonRate:3},callsBenchmark:85,performanceGoalsVersion:1,callsCurrentBenchmark:69.2,headcountMax:175,openHours:8.5,serviceSeconds:120,maxAgents:1000,limits:{abandonRate:[0,20,.1,8],waitTarget:[0,600,1,120],patience:[1,600,1,90],serviceTarget:[0,100,.1,77]}};
export function validateCampaignState(data){
  if(!data||data.version!==1||!data.config||!data.values)throw Error('Unsupported Campaign backup.');
  const c=data.config;
  if(c.version!==1||!Number.isFinite(c.openHours)||c.openHours<.1||c.openHours>24||!Number.isFinite(c.serviceSeconds)||c.serviceSeconds<0||c.serviceSeconds>3600||!Number.isInteger(c.maxAgents)||c.maxAgents<1||c.maxAgents>1000)throw Error('Check Campaign operating hours, service threshold, and staffing limit.');
  for(const [k,ceiling]of Object.entries({abandonRate:100,waitTarget:3600,patience:7200,serviceTarget:100})){
    const l=c.limits?.[k],min=k==='patience'?1:0;
    if(!Array.isArray(l)||l.length!==4||l.some(x=>!Number.isFinite(x))||l[0]<min||l[1]>ceiling||l[1]<=l[0]||l[2]<=0||l[2]>l[1]-l[0]||l[3]<l[0]||l[3]>l[1]||!Number.isFinite(data.values[k])||data.values[k]<l[0]||data.values[k]>l[1])throw Error('Check Campaign '+k+' range and values.');
  }
  if(!Number.isInteger(data.day)||data.day<0||data.day>4)throw Error('Check the Campaign weekday.');
  const next=copy(data);
  if(next.config.abandonRangeVersion!==1){next.config.abandonRangeVersion=1;next.config.limits.abandonRate=[0,20,.1,clamp(next.config.limits.abandonRate[3],0,20)];next.values.abandonRate=clamp(next.values.abandonRate,0,20);}
  if(next.config.benchmarks===undefined)next.config.benchmarks={serviceTarget:75,abandonRate:3};
  for(const k of ['serviceTarget','abandonRate'])if(!Number.isFinite(next.config.benchmarks?.[k])||next.config.benchmarks[k]<0||next.config.benchmarks[k]>100)throw Error('Check Campaign '+k+' benchmark.');
  if(next.focus===undefined)next.focus='all';
  if(!['all','abandonRate','waitTarget','serviceTarget'].includes(next.focus))throw Error('Check the Campaign planning target.');
  if(next.config.callsBenchmark===undefined)next.config.callsBenchmark=85;
  if(next.config.performanceGoalsVersion!==1){next.config.callsBenchmark=85;next.config.performanceGoalsVersion=1;}
  if(!Number.isFinite(next.config.callsBenchmark)||next.config.callsBenchmark<=0||next.config.callsBenchmark>10000)throw Error('Check the calls-per-agent benchmark.');
  // Patience moved from a temporary scenario slider into an Admin assumption.
  // Use its configured default once; preserve explicit Admin defaults thereafter.
  if(next.config.queueAssumptionsVersion!==1){next.values.patience=next.config.limits.patience[3];next.config.queueAssumptionsVersion=1;}
  if(next.config.headcountMax===undefined)next.config.headcountMax=175;
  if(!Number.isInteger(next.config.headcountMax)||next.config.headcountMax<1||next.config.headcountMax>10000)throw Error('Check Campaign headcount maximum.');
  if(next.headcount===undefined)next.headcount=null;
  if(next.headcount!==null&&(!Number.isInteger(next.headcount)||next.headcount<0||next.headcount>next.config.headcountMax))throw Error('Check Campaign combined headcount.');
  if(next.config.callsCurrentBenchmark===undefined)next.config.callsCurrentBenchmark=69.2;
  if(!Number.isFinite(next.config.callsCurrentBenchmark)||next.config.callsCurrentBenchmark<=0||next.config.callsCurrentBenchmark>10000)throw Error('Check the current calls-per-agent benchmark.');
  return next;
}
export function campaignInitial(config=campaignDefaults){return {version:1,focus:'all',headcount:null,config:copy(config),values:Object.fromEntries(Object.entries(config.limits).map(([k,l])=>[k,l[3]])),day:0};}
export function campaignCounts(queued,rate){const abandoned=Math.round(queued*clamp(rate,0,100)/100);return {queued,abandoned,handled:queued-abandoned};}

export function queueStats({arrivalRate,aht,patience,agents,serviceSeconds}){
  if(!Number.isFinite(arrivalRate)||arrivalRate<0||!Number.isFinite(aht)||aht<=0||!Number.isFinite(patience)||patience<=0||!Number.isInteger(agents)||agents<0||!Number.isFinite(serviceSeconds)||serviceSeconds<0)throw Error('Invalid queue inputs.');
  if(arrivalRate===0)return {served:1,abandon:0,service:1,wait:0,abandonWait:0,queue:0,occupancy:0,immediate:1};
  if(agents===0)return {served:0,abandon:1,service:0,wait:Infinity,abandonWait:patience,queue:arrivalRate*patience,occupancy:0,immediate:0};
  const mu=1/aht,theta=1/patience,logs=[0];let peak=0,done=false;
  for(let k=1;k<=20000;k++){
    const death=Math.min(k,agents)*mu+Math.max(0,k-agents)*theta;
    const next=logs[k-1]+Math.log(arrivalRate/death);logs.push(next);peak=Math.max(peak,next);
    if(k>agents&&death>arrivalRate&&next<peak-38){done=true;break;}
  }
  if(!done)throw Error('Demand is outside the supported queue-model range.');
  const w=logs.map(x=>Math.exp(x-peak)),total=w.reduce((a,b)=>a+b,0),p=w.map(x=>x/total);
  let served=0,service=0,servedWait=0,queue=0,busy=0,immediate=0;
  const b=agents*mu/theta+1,x=-Math.expm1(-theta*serviceSeconds);
  let sumRecip=0,logTerm=-b*theta*serviceSeconds,cumulative=0;
  for(let k=0;k<p.length;k++){
    busy+=p[k]*Math.min(k,agents);queue+=p[k]*Math.max(0,k-agents);
    if(k<agents){immediate+=p[k];served+=p[k];service+=p[k];continue;}
    const q=k-agents,d=agents*mu+(q+1)*theta,probServe=agents*mu/d;
    sumRecip+=1/d;
    // The conditional served-wait CDF is I_x(q+1,b). Its complement is a
    // negative-binomial partial sum, evaluated recursively in log space.
    if(q>0)logTerm+=Math.log(b+q-1)-Math.log(q)+Math.log(x);
    cumulative+=Math.exp(logTerm);
    const cdf=clamp(1-cumulative,0,1);
    served+=p[k]*probServe;servedWait+=p[k]*probServe*sumRecip;service+=p[k]*probServe*cdf;
  }
  const abandon=clamp(theta*queue/arrivalRate,0,1),allWait=queue/arrivalRate;
  return {served:clamp(served,0,1),abandon,service:clamp(service,0,served),wait:served>0?servedWait/served:Infinity,abandonWait:abandon>1e-14?Math.max(0,(allWait-servedWait)/abandon):0,queue,occupancy:busy/agents,immediate};
}

export function planCampaign({queued,aht,config,values,agentConfig,agentValues,focus='all'}){
  if(!['all','abandonRate','waitTarget','serviceTarget'].includes(focus))throw Error('Invalid Campaign planning target.');
  const target=campaignCounts(queued,values.abandonRate),availability=Math.max(0,(agentConfig.shift*3600-agentValues.acw)/(agentConfig.shift*3600)),targetKeys=['abandonRate','waitTarget','serviceTarget'];
  const checks={abandonRate:s=>s.abandon<=values.abandonRate/100+1e-10,waitTarget:s=>s.wait<=values.waitTarget+1e-8,serviceTarget:s=>s.service>=values.serviceTarget/100-1e-10};
  if(!queued)return {target,focus,feasible:true,active:0,headcount:0,gap:-agentValues.agents,requirements:Object.fromEntries(targetKeys.map(k=>[k,{active:0,headcount:0}])),drivers:[],goalStatus:null,allMet:true,stats:queueStats({arrivalRate:0,aht,patience:values.patience,agents:0,serviceSeconds:config.serviceSeconds}),modeled:{handled:0,abandoned:0}};
  if(availability<=0)return {target,focus,feasible:false,reason:'Daily ACW leaves no call-handling time. Reduce ACW in Agent view.',active:null,headcount:null};
  const cache=new Map(),evaluate=n=>{if(!cache.has(n))cache.set(n,queueStats({arrivalRate:queued/(config.openHours*3600),aht,patience:values.patience,agents:n,serviceSeconds:config.serviceSeconds}));return cache.get(n);};
  const scheduled=n=>Math.max(0,Math.ceil(n/availability+agentValues.shrink-agentValues.support*agentConfig.contribution/100-1e-9));
  try{
    const best=evaluate(config.maxAgents),requirements={};
    for(const k of targetKeys){if(!checks[k](best)){requirements[k]={active:null,headcount:null};continue;}let lo=1,hi=config.maxAgents;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(checks[k](evaluate(mid)))hi=mid;else lo=mid+1;}requirements[k]={active:lo,headcount:scheduled(lo)};}
    const selected=focus==='all'?targetKeys:[focus];
    if(selected.some(k=>requirements[k].active===null))return {target,focus,requirements,feasible:false,reason:'Selected targets cannot be met within the '+config.maxAgents+' active-agent search limit.',active:null,headcount:null};
    const active=Math.max(...selected.map(k=>requirements[k].active)),stats=evaluate(active),headcount=scheduled(active),goalStatus=Object.fromEntries(targetKeys.map(k=>[k,checks[k](stats)])),drivers=selected.filter(k=>requirements[k].active===active),abandoned=Math.round(queued*stats.abandon);
    return {target,focus,feasible:true,active,headcount,gap:headcount-agentValues.agents,stats,availability,requirements,drivers,goalStatus,allMet:Object.values(goalStatus).every(Boolean),modeled:{abandoned,handled:queued-abandoned}};
  }catch(e){return {target,focus,feasible:false,active:null,headcount:null,reason:e.message};}
}

export function scaleCampaignDemand(days,selected,queued,max){const anchor=days[selected];return days.map((d,i)=>i===selected?Math.round(clamp(queued,0,max)):Math.round(clamp(anchor>0?d*queued/anchor:queued,0,max)));}
export function campaignStaffingBattery(required,current){if(!Number.isFinite(required)||required<0)return {green:0,red:0,covered:0,additional:0,spare:0,empty:true,numberOnEmpty:true};const covered=Math.min(required,current),additional=Math.max(0,required-current),spare=Math.max(0,current-required),scale=Math.max(required,current,1),green=covered/scale,red=additional/scale;return {green,red,covered,additional,spare,empty:required===0,numberOnEmpty:green+red<.5};}

/** Forward scenario: fixed staffing produces queue outcomes, rather than solving staffing targets. */
export function campaignOutcomes({queued,aht,config,values,agentConfig,agentValues}){
 const productive=Math.max(0,agentConfig.shift*3600-agentValues.acw),fte=Math.max(0,agentValues.agents-agentValues.shrink)+agentValues.support*agentConfig.contribution/100,per=aht>0?productive/aht:0,capacity=Math.floor(fte*per+1e-9),active=Math.floor(fte*productive/(config.openHours*3600)+1e-9);
 if(!Number.isFinite(queued)||queued<0||!Number.isFinite(aht)||aht<=0)return {valid:false,reason:'Enter valid demand and an AHT greater than zero.'};
 try{
  const stats=queueStats({arrivalRate:queued/(config.openHours*3600),aht,patience:values.patience,agents:active,serviceSeconds:config.serviceSeconds});
  const handled=queued?Math.min(queued,capacity,Math.round(queued*stats.served)):0,abandoned=queued-handled,abandonRate=queued?abandoned/queued*100:0,service=queued?Math.min(stats.service,handled/queued)*100:null,wait=queued&&handled>0?stats.wait:null;
  const goals=config.benchmarks||{serviceTarget:75,abandonRate:3},goalStatus=queued?{abandonRate:abandonRate<=goals.abandonRate+1e-8,waitTarget:wait!==null&&wait<=values.waitTarget+1e-8,serviceTarget:service>=goals.serviceTarget-1e-8}:null;
  return {valid:true,queued,handled,abandoned,abandonRate,service,wait,per,capacity,fte,active,productive,stats,goalStatus,allMet:goalStatus?Object.values(goalStatus).every(Boolean):null};
 }catch(e){return {valid:false,reason:e.message,per,capacity,active};}
}
export function campaignAhtForCalls(calls,acw,config){
 if(!Number.isFinite(calls)||calls<=0)return {valid:false,reason:'Calls per agent must be greater than zero; AHT and ACW determine the achievable average.'};
 const productive=Math.max(0,config.shift*3600-acw),l=config.limits.aht,wanted=productive/calls,aht=clamp(l[0]+Math.round((wanted-l[0])/l[2])*l[2],l[0],l[1]);
 return {valid:true,aht,actual:aht>0?productive/aht:0,limited:wanted<l[0]||wanted>l[1]};
}

// A Campaign headcount includes support; allocate it once using the shared support mix.
export function campaignStaffingValues(values,total){if(!Number.isInteger(total)||total<0)throw Error('Combined headcount must be a non-negative whole number.');const support=Math.min(values.support,total);return {...values,agents:total-support,support};}
