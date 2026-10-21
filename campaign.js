import {campaignDefaults,campaignInitial,validateCampaignState,campaignCounts,planCampaign,scaleCampaignDemand,campaignStaffingBattery} from './campaign-model.js';
const names=['Monday','Tuesday','Wednesday','Thursday','Friday'],keys=['queued','handled','abandoned','abandonRate','waitTarget','patience','serviceTarget','aht','acw'];
const labels={queued:'Queued calls',handled:'Handled calls',abandoned:'Abandoned calls',abandonRate:'Abandonment',waitTarget:'Average wait time',patience:'Avg abandon time',serviceTarget:'Service level',aht:'Average handle time',acw:'Daily after-call work'};
const notes={queued:'Scales all five weekdays',handled:'Queued − abandoned',abandoned:'From abandonment %',abandonRate:'Maximum target',waitTarget:'Maximum answered wait',patience:'Caller-patience assumption',serviceTarget:'Minimum target',aht:'Shared with Agent view',acw:'Daily total / Agent view'};
const fmt=(n,d=0)=>Number.isFinite(n)?n.toLocaleString('en-US',{maximumFractionDigits:d}):'—';
const time=n=>Math.floor(n/60)+':'+String(Math.round(n%60)).padStart(2,'0');
const copy=x=>JSON.parse(JSON.stringify(x)),clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
export function createCampaignController({getShared,updateShared,updateSharedDefaults,onStatus}){
 const $=id=>document.getElementById(id);
 let state=campaignInitial({...copy(campaignDefaults),openHours:getShared().config.shift}),memoKey='',plans=[],demandBase=null,lastDemand=null,lastAbandonRate=null,headcountNote='';
 try{const saved=JSON.parse(localStorage.getItem('monreal-campaign-v1'));if(saved)state=validateCampaignState(saved);}catch{onStatus('Campaign settings could not be restored. Original Campaign defaults are in use.');}
 function save(){try{localStorage.setItem('monreal-campaign-v1',JSON.stringify(state));}catch{onStatus('Campaign changes could not be saved in this browser. Download a backup to keep them.');}}
 function limit(k){const s=getShared();if(k==='aht'||k==='acw')return s.config.limits[k];if(k==='handled'||k==='abandoned')return [0,Math.max(1,s.config.days[state.day]),1,0];return k==='queued'?[0,s.config.dayMax,1,0]:state.config.limits[k];}
 function value(k){const s=getShared(),q=s.config.days[state.day],counts=campaignCounts(q,state.values.abandonRate);return k==='aht'||k==='acw'?s.values[k]:k in counts?counts[k]:state.values[k];}
 function unit(k){return k==='acw'?'MIN : SEC / DAY':k==='aht'?'MIN : SEC':k==='waitTarget'||k==='patience'?'SECONDS':k==='abandonRate'||k==='serviceTarget'?'PERCENT':'CALLS / DAY';}
 function shown(k,n){return k==='aht'||k==='acw'?time(n):fmt(n,['serviceTarget','abandonRate'].includes(k)?2:0);}
 function build(){demandBase=null;lastDemand=null;
  $('campaignSliders').innerHTML=keys.map((k,i)=>{const l=limit(k);return '<article class="campaign-slider '+(['handled','abandoned'].includes(k)?'campaign-derived':'')+'"><span class="n">'+(['handled','abandoned'].includes(k)?'LINKED':'SCENARIO')+' / '+String(i+1).padStart(2,'0')+'</span><h3>'+labels[k]+'</h3><div class="desc" '+(k==='serviceTarget'?'id="campaignSLLabel"':'')+'>'+notes[k]+'</div><div class="value" id="campaignValue-'+k+'">—</div><div class="value-unit">'+unit(k)+'</div><div class="track-area"><div class="scale"><span>'+shown(k,l[1])+'</span><span>'+shown(k,(l[0]+l[1])/2)+'</span><span>'+shown(k,l[0])+'</span></div><input type="range" class="vertical" id="campaignRange-'+k+'" min="'+l[0]+'" max="'+l[1]+'" step="'+l[2]+'" aria-label="Campaign '+labels[k]+'"></div><input class="precise" type="number" id="campaignNumber-'+k+'" min="'+l[0]+'" max="'+l[1]+'" step="'+(k==='abandonRate'?'any':l[2])+'" aria-label="Campaign '+labels[k]+' exact value"><small class="campaign-input-unit">'+(k==='aht'||k==='acw'?'seconds':'')+'</small></article>';}).join('');
  keys.forEach(k=>{for(const kind of ['Range','Number'])$('campaign'+kind+'-'+k).addEventListener(kind==='Range'?'input':'change',e=>{if(e.target.value===''||!e.target.checkValidity()){refresh();return;}change(k,+e.target.value);});});
  const queuedRange=$('campaignRange-queued'),queuedNumber=$('campaignNumber-queued');const beginDemand=()=>{demandBase=null;lastDemand=null;};queuedRange.addEventListener('pointerdown',beginDemand);queuedRange.addEventListener('keydown',e=>{if(!e.repeat)beginDemand();});queuedNumber.addEventListener('focus',beginDemand);
  $('campaignDays').innerHTML=names.map((name,i)=>'<article class="campaign-day" id="campaignDay-'+i+'"><button type="button" id="campaignSelect-'+i+'" aria-label="Campaign plan for '+name+'">'+name+'</button><div class="campaign-battery-wrap"><div class="battery campaign-staff-battery" id="campaignBattery-'+i+'" role="img"><div class="inside"><div class="uncovered" id="campaignStaffRed-'+i+'"></div><div class="covered" id="campaignStaffGreen-'+i+'"></div></div><strong class="campaign-battery-number" id="campaignHC-'+i+'">—</strong></div><div class="campaign-battery-caption">Required headcount</div></div><dl><div><dt>Queued</dt><dd id="campaignQ-'+i+'">—</dd></div><div><dt>Handled target</dt><dd id="campaignH-'+i+'">—</dd></div><div><dt>Abandoned target</dt><dd id="campaignA-'+i+'">—</dd></div><div><dt>Predicted abandon</dt><dd id="campaignP-'+i+'">—</dd></div></dl></article>').join('');
  names.forEach((_,i)=>$('campaignSelect-'+i).onclick=()=>{state.day=i;refresh();});
 }
 function change(k,n){const l=limit(k);n=clamp(n,l[0],l[1]);if(k==='queued'){const shared=getShared();if(!demandBase||demandBase.day!==state.day||(lastDemand&&!shared.config.days.every((d,i)=>d===lastDemand[i])))demandBase={day:state.day,days:[...shared.config.days]};const days=scaleCampaignDemand(demandBase.days,state.day,Math.round(n),shared.config.dayMax);lastDemand=days;updateShared({days});return;}if(k==='aht'||k==='acw'){updateShared({[k]:Math.round(n)});return;}
  if(k==='handled'||k==='abandoned'){const q=getShared().config.days[state.day];if(q===0){onStatus('Set queued calls above zero before adjusting handled or abandoned totals.');refresh();return;}const abandoned=k==='handled'?q-Math.min(q,Math.round(n)):Math.min(q,Math.round(n));state.values.abandonRate=clamp(abandoned/q*100,...state.config.limits.abandonRate.slice(0,2));}
  else state.values[k]=n;
  refresh();
 }
 function refresh(){
  const s=getShared(),key=JSON.stringify([s.config.days,s.config.shift,s.config.contribution,s.values.aht,s.values.acw,s.values.shrink,s.values.support,s.values.agents,state.config,state.values]);
  if(key!==memoKey){const oldPlans=plans;plans=s.config.days.map(queued=>planCampaign({queued,aht:s.values.aht,config:state.config,values:state.values,agentConfig:s.config,agentValues:s.values}));headcountNote=lastAbandonRate!==null&&lastAbandonRate!==state.values.abandonRate&&oldPlans.length===5&&s.config.days.some(d=>d>0)&&plans.every((p,i)=>p.feasible&&oldPlans[i].feasible&&p.headcount===oldPlans[i].headcount)?'Targets updated. Headcount is unchanged because whole-agent rounding or the wait/service targets set the requirement.':'';lastAbandonRate=state.values.abandonRate;memoKey=key;}
  const plan=plans[state.day],stats=plan.stats,q=s.config.days[state.day];
  $('campaignRequired').textContent=plan.feasible?fmt(plan.headcount):'—';
  $('campaignGap').textContent=!plan.feasible?'No feasible estimate':plan.gap>0?fmt(plan.gap)+' above '+fmt(s.values.agents)+' primary agents':fmt(Math.abs(plan.gap))+' below '+fmt(s.values.agents)+' primary agents';
  $('campaignActive').textContent=plan.feasible?fmt(plan.active):'—';
  $('campaignWait').textContent=q&&plan.feasible?fmt(stats.wait,1)+' sec':'—';
  $('campaignService').textContent=q&&plan.feasible?fmt(stats.service*100,1)+'%':'—';
  $('campaignWithin').textContent='Answered within '+fmt(state.config.serviceSeconds)+' seconds';
  $('campaignTargets').textContent='Targets: ≤ '+fmt(state.values.abandonRate,2)+'% abandoned · ≤ '+fmt(state.values.waitTarget)+' sec average wait · ≥ '+fmt(state.values.serviceTarget,1)+'% answered within '+fmt(state.config.serviceSeconds)+' sec';
  $('campaignPredicted').textContent=plan.feasible&&q?'Predicted: '+fmt(plan.modeled.handled)+' handled · '+fmt(plan.modeled.abandoned)+' abandoned ('+fmt(stats.abandon*100,2)+'%) · '+fmt(stats.occupancy*100,1)+'% occupancy.':q?(plan.reason||'Review the planning inputs.'):'No staffing required for zero queued calls.';if(headcountNote)$('campaignPredicted').textContent+=' '+headcountNote;
  $('campaignPredicted').classList.toggle('campaign-error',!plan.feasible);
  $('campaignShared').textContent='Agent settings: '+fmt(s.config.shift,1)+'h shift · '+fmt(s.values.acw/60,1)+' min daily ACW · '+fmt(s.values.shrink)+' unavailable · '+fmt(s.values.support)+' support HC';
  $('campaignDayChoice').value=state.day;
  $('campaignSLLabel').textContent='Target within '+fmt(state.config.serviceSeconds)+' sec';
  for(const k of keys){const l=limit(k),n=value(k),r=$('campaignRange-'+k),input=$('campaignNumber-'+k);r.min=input.min=l[0];r.max=input.max=l[1];r.step=l[2];r.value=n;input.value=Math.round(n*1000000)/1000000;r.style.setProperty('--fill',clamp((n-l[0])/(l[1]-l[0])*100,0,100)+'%');$('campaignValue-'+k).textContent=shown(k,n);}
  plans.forEach((p,i)=>{$('campaignDay-'+i).classList.toggle('selected',state.day===i);$('campaignHC-'+i).textContent=p.feasible?fmt(p.headcount):'—';const battery=campaignStaffingBattery(p.feasible?p.headcount:null,s.values.agents);$('campaignStaffGreen-'+i).style.flex='none';$('campaignStaffGreen-'+i).style.height=(battery.green*100)+'%';$('campaignStaffRed-'+i).style.height=(battery.red*100)+'%';$('campaignBattery-'+i).classList.toggle('empty',battery.empty);$('campaignBattery-'+i).classList.toggle('number-on-empty',battery.numberOnEmpty);$('campaignBattery-'+i).classList.toggle('four-digits',p.headcount>=1000);const batteryLabel=names[i]+': '+(p.feasible?fmt(p.headcount)+' primary agents required; '+fmt(battery.covered)+' current agents needed; '+fmt(battery.additional)+' additional agents needed; '+fmt(battery.spare)+' spare agents.':p.reason||'No feasible estimate.');$('campaignBattery-'+i).setAttribute('aria-label',batteryLabel);$('campaignBattery-'+i).title=batteryLabel;$('campaignQ-'+i).textContent=fmt(p.target.queued);$('campaignH-'+i).textContent=fmt(p.target.handled);$('campaignA-'+i).textContent=fmt(p.target.abandoned);$('campaignP-'+i).textContent=p.feasible&&p.target.queued?fmt(p.stats.abandon*100,2)+'%':'—';});
  save();
 }
 function adminFill(){
  const s=getShared(),f=$('campaignAdminForm');f.elements.campaignAdminDay.value=state.day;f.elements.campaignHours.value=state.config.openHours;f.elements.campaignThreshold.value=state.config.serviceSeconds;f.elements.campaignMaxAgents.value=state.config.maxAgents;f.elements.campaignQueued.value=s.config.days[state.day];f.elements.campaignAhtMin.value=Math.floor(s.config.benchmarks.ahtCurrent/60);f.elements.campaignAhtSec.value=s.config.benchmarks.ahtCurrent%60;f.elements.campaignAcwMin.value=Math.floor(s.config.benchmarks.acwCurrent/60);f.elements.campaignAcwSec.value=s.config.benchmarks.acwCurrent%60;
  for(const k of Object.keys(state.config.limits))f.elements['campaignDefault-'+k].value=state.config.limits[k][3];
  $('campaignLimitRows').innerHTML=Object.entries(state.config.limits).map(([k,l])=>'<tr><td>'+labels[k]+'</td>'+['min','max','step'].map((name,i)=>'<td><input type="number" name="campaignLimit-'+k+'-'+i+'" aria-label="Campaign '+labels[k]+' '+name+'" value="'+l[i]+'" step="any" required></td>').join('')+'</tr>').join('');
  adminCounts();$('campaignAdminMessage').hidden=true;
 }
 function adminCounts(source){
  const f=$('campaignAdminForm'),q=Number(f.elements.campaignQueued.value),rate=f.elements['campaignDefault-abandonRate'];
  if(source==='handled'&&q>0)rate.value=clamp((q-Number(f.elements.campaignHandled.value))/q*100,0,100);
  if(source==='abandoned'&&q>0)rate.value=clamp(Number(f.elements.campaignAbandoned.value)/q*100,0,100);
  const c=campaignCounts(q,Number(rate.value));f.elements.campaignHandled.value=c.handled;f.elements.campaignAbandoned.value=c.abandoned;
 }
 $('campaignAdminForm').onsubmit=e=>{e.preventDefault();try{const f=e.target,next=copy(state);next.config.openHours=Number(f.elements.campaignHours.value);next.config.serviceSeconds=Number(f.elements.campaignThreshold.value);next.config.maxAgents=Number(f.elements.campaignMaxAgents.value);next.day=Number(f.elements.campaignAdminDay.value);
  for(const k of Object.keys(next.config.limits)){next.config.limits[k]=[0,1,2].map(i=>Number(f.elements['campaignLimit-'+k+'-'+i].value)).concat(Number(f.elements['campaignDefault-'+k].value));next.values[k]=next.config.limits[k][3];}
  const valid=validateCampaignState(next),aht=Number(f.elements.campaignAhtMin.value)*60+Number(f.elements.campaignAhtSec.value),queued=Number(f.elements.campaignQueued.value),acw=Number(f.elements.campaignAcwMin.value)*60+Number(f.elements.campaignAcwSec.value),s=getShared();
  if(!Number.isInteger(queued)||queued<0||queued>s.config.dayMax)throw Error('Campaign queued calls must be within the shared daily volume range.');
  if(!Number.isInteger(aht)||aht<s.config.limits.aht[0]||aht>s.config.limits.aht[1]||(aht-s.config.limits.aht[0])%s.config.limits.aht[2]!==0)throw Error('Campaign AHT must match the shared AHT range and step.');
  if(!Number.isInteger(acw)||acw<s.config.limits.acw[0]||acw>s.config.limits.acw[1]||(acw-s.config.limits.acw[0])%s.config.limits.acw[2]!==0)throw Error('Campaign ACW must match the shared daily ACW range and step.');
  state=valid;updateSharedDefaults({day:state.day,queued,aht,acw});build();refresh();adminFill();$('campaignAdminMessage').textContent='Campaign defaults saved. Shared weekday demand, AHT, and daily ACW are updated.';$('campaignAdminMessage').hidden=false;
 }catch(err){$('campaignAdminMessage').textContent=err.message;$('campaignAdminMessage').hidden=false;}};
 const f=$('campaignAdminForm');
 f.elements.campaignAdminDay.onchange=e=>{f.elements.campaignQueued.value=getShared().config.days[Number(e.target.value)];adminCounts();};
 for(const name of ['campaignQueued','campaignDefault-abandonRate'])f.elements[name].oninput=()=>adminCounts();
 f.elements.campaignHandled.onchange=()=>adminCounts('handled');f.elements.campaignAbandoned.onchange=()=>adminCounts('abandoned');
 $('campaignDayChoice').onchange=e=>{state.day=Number(e.target.value);refresh();};
 
 build();refresh();
 return {refresh,adminFill,exportState:()=>copy(state),restore:data=>{state=validateCampaignState(data);memoKey='';build();refresh();},reset:()=>{state.values=Object.fromEntries(Object.entries(state.config.limits).map(([k,l])=>[k,l[3]]));refresh();}};
}

