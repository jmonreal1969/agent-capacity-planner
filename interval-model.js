import {sourceRoster,sourceCalls} from './interval-data.js';
import {queueStats} from './campaign-model.js';
export const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday'];
const clone=x=>JSON.parse(JSON.stringify(x));
export const intervalDefaults={version:1,aht:338,acw:110,unavailable:32,patience:90,serviceSeconds:120,serviceGoal:75,abandonGoal:3,waitGoal:120,roster:{},calls:{}};
export function clock(n){return String(Math.floor(n/60)).padStart(2,'0')+':'+String(n%60).padStart(2,'0');}
export function rosterFor(c){return sourceRoster.map((r,i)=>clone(c.roster[i]||r));}
function integer(v,min,max){return Number.isInteger(v)&&v>=min&&v<=max;}
export function validateRoster(r){
 if(!Array.isArray(r)||r.length!==8||typeof r[0]!=='string'||r[0].length<1||r[0].length>60||!Array.isArray(r[1])||new Set(r[1]).size!==r[1].length||!r[1].every(d=>integer(d,0,6)))throw Error('Check agent name and working days.');
 if(!r.slice(2).every(x=>integer(x,0,1440))||![30,60].includes(r[6])||r[3]-r[2]!== (r[6]===30?510:540))throw Error('Domestic shifts must be 8.5 hours; offshore shifts must be 9 hours. Lunch must be 30 or 60 minutes.');
 const events=[[r[4],15],[r[5],r[6]],[r[7],15]];
 if(events.some(([s,n])=>s<r[2]||s+n>r[3])||events.some(([s,n],i)=>events.some(([t,m],j)=>i<j&&s<t+m&&t<s+n)))throw Error('Lunches and breaks must fit inside the shift and cannot overlap.');
 return clone(r);
}
export function validateIntervalConfig(value){
 const c=clone(value);if(!c||c.version!==1)throw Error('Unsupported Interval settings.');
 for(const [k,min,max]of [['aht',240,360],['acw',60,150],['unavailable',0,sourceRoster.length],['patience',1,7200],['serviceSeconds',0,3600],['serviceGoal',0,100],['abandonGoal',0,100],['waitGoal',0,3600]])if(!Number.isFinite(c[k])||c[k]<min||c[k]>max)throw Error('Check Interval '+k+'.');
 if(!Number.isInteger(c.unavailable))throw Error('Unavailable agents must be a whole number.');
 for(const k of ['roster','calls'])if(!c[k]||typeof c[k]!=='object'||Array.isArray(c[k]))throw Error('Check Interval source data.');
 for(const [id,r]of Object.entries(c.roster)){if(!/^\d+$/.test(id)||!integer(+id,0,sourceRoster.length-1))throw Error('Unknown roster agent.');validateRoster(r);}
 for(const [key,n]of Object.entries(c.calls))if(!/^(?:[0-9]|1[0-9]|2[0-3]):[0-4]$/.test(key)||!Number.isFinite(n)||n<0||n>5000)throw Error('Interval calls must be between 0 and 5,000.');
 return c;
}
export function intervalInitial(config=intervalDefaults){return {version:1,config:validateIntervalConfig(config),day:Math.min(4,Math.max(0,(new Date().getDay()+6)%7)),aht:config.aht,acw:config.acw,unavailable:config.unavailable,absent:[],exact:false,proposed:{},view:'current'};}
export function validateIntervalState(s){
 if(!s||s.version!==1)throw Error('Unsupported Interval scenario.');
 const next=intervalInitial(validateIntervalConfig(s.config));
 for(const k of ['day','aht','acw','unavailable','absent','exact','proposed','view'])if(s[k]!==undefined)next[k]=clone(s[k]);
 validateIntervalConfig({...next.config,aht:next.aht,acw:next.acw,unavailable:next.unavailable});
 if(!integer(next.day,0,4)||typeof next.exact!=='boolean'||!['current','proposed'].includes(next.view)||!Array.isArray(next.absent)||new Set(next.absent).size!==next.absent.length||!next.absent.every(i=>integer(i,0,sourceRoster.length-1)))throw Error('Check Interval scenario.');
 if(!next.proposed||typeof next.proposed!=='object'||Array.isArray(next.proposed))throw Error('Check proposed schedule.');
 const roster=rosterFor(next.config);
 for(const [key,v]of Object.entries(next.proposed)){if(!/^\d+$/.test(key)||!integer(+key,0,roster.length-1)||!Array.isArray(v)||v.length!==3)throw Error('Check proposed lunch and breaks.');const r=roster[+key];[r[4],r[5],r[7]]=v;validateRoster(r);}
 return next;
}
const neededCache=new Map();
export function agentsNeeded(queued,aht,c){
 if(!queued)return 0;
 const key=[queued,aht,c.patience,c.serviceSeconds,c.serviceGoal,c.abandonGoal,c.waitGoal].join('|');if(neededCache.has(key))return neededCache.get(key);
 const meets=n=>{const s=queueStats({arrivalRate:queued/1800,aht,patience:c.patience,agents:n,serviceSeconds:c.serviceSeconds});return s.service*100>=c.serviceGoal-1e-8&&s.abandon*100<=c.abandonGoal+1e-8&&s.wait<=c.waitGoal+1e-8;};
 let lo=0,hi=1000;if(!meets(hi))return null;while(lo<hi){const n=Math.floor((lo+hi)/2);if(meets(n))hi=n;else lo=n+1;}
 if(neededCache.size>10000)neededCache.clear();neededCache.set(key,lo);return lo;
}
export function coverage(s,view=s.view){
 const all=rosterFor(s.config),scheduled=all.map((r,i)=>({r,i})).filter(({r})=>r[1].includes(s.day)),off=all.length-scheduled.length;
 const exactAbsent=new Set(s.absent),extra=s.exact?scheduled.filter(({i})=>exactAbsent.has(i)).length:Math.min(scheduled.length,Math.max(0,s.unavailable-off));
 const factor=scheduled.length?(scheduled.length-extra)/scheduled.length:0;
 const result=Array.from({length:24},(_,i)=>({start:420+i*30,calls:s.config.calls[i+':'+s.day]??sourceCalls[i][s.day],onShift:0,lunch:0,breaks:0,absence:0,wrap:0,available:0}));
 // ACW is a domestic total (30 lunch + 30 breaks + wrap). Offshore gets 30 extra lunch minutes.
 // Allocate only residual wrap-up over the actual non-lunch/break minutes; no second ACW deduction.
 const wrap=Math.max(0,s.acw-60),wrapRatio=Math.min(1,wrap/450);
 for(const {r:base,i}of scheduled){const r=clone(base);if(view==='proposed'&&s.proposed[i])[r[4],r[5],r[7]]=s.proposed[i];const present=s.exact?(exactAbsent.has(i)?0:1):factor;
  for(const row of result){for(let t=row.start;t<row.start+30;t++)if(t>=r[2]&&t<r[3]){row.onShift+=1/30;row.absence+=(1-present)/30;if(t>=r[5]&&t<r[5]+r[6])row.lunch+=present/30;else if(t>=r[4]&&t<r[4]+15||t>=r[7]&&t<r[7]+15)row.breaks+=present/30;else{row.wrap+=present*wrapRatio/30;row.available+=present*(1-wrapRatio)/30;}}}
 }
 for(const row of result){row.needed=agentsNeeded(row.calls,s.aht,s.config);row.gap=row.needed===null?null:row.available-row.needed;row.capacity=row.available*1800/s.aht;}
 return {rows:result,roster:all.length,scheduled:scheduled.length,off,extra,present:scheduled.length-extra,domestic:scheduled.filter(({r})=>r[6]===30).length,offshore:scheduled.filter(({r})=>r[6]===60).length,unavailable:off+extra,clamped:!s.exact&&s.unavailable<off,wrap,wrapRatio};
}
export function shortageHours(rows){return rows.reduce((n,r)=>n+Math.max(0,-(r.gap??0))*.5,0);}
export function recommendBreakMove(s){
 const base=coverage(s,'proposed'),roster=rosterFor(s.config),score=shortageHours(base.rows);let best=null;
 if(base.rows.some(r=>r.needed===null))return null;
 // Move one scheduled event by at most one hour, keeping all shift and non-overlap constraints.
 for(let i=0;i<roster.length;i++){const r=roster[i];if(!r[1].includes(s.day)||s.exact&&s.absent.includes(i))continue;const old=s.proposed[i]||[r[4],r[5],r[7]];
  for(let j=0;j<3;j++)for(const delta of [-60,-45,-30,-15,15,30,45,60]){const times=[...old];times[j]+=delta;const candidate=clone(r);[candidate[4],candidate[5],candidate[7]]=times;try{validateRoster(candidate);}catch{continue;}
   const off=roster.length-base.scheduled,extra=Math.min(base.scheduled,Math.max(0,s.unavailable-off));
   const present=s.exact?1:(base.scheduled-extra)/base.scheduled;
   const contribution=eventTimes=>base.rows.map(row=>{let minutes=0;for(let t=row.start;t<row.start+30;t++)if(t>=r[2]&&t<r[3]&&![[eventTimes[0],15],[eventTimes[1],r[6]],[eventTimes[2],15]].some(([start,n])=>t>=start&&t<start+n))minutes++;return minutes/30*present*(1-base.wrapRatio);});
   const before=contribution(old),after=contribution(times),rows=base.rows.map((row,k)=>({...row,available:row.available+after[k]-before[k],gap:row.gap+after[k]-before[k]}));
   // Do not create a new shortage or deepen a shortage in any affected interval.
   if(rows.some((x,k)=>Math.max(0,-x.gap)>Math.max(0,-base.rows[k].gap)+1e-7))continue;
   const improvement=score-shortageHours(rows);if(improvement>1e-6&&(!best||improvement>best.improvement+1e-9))best={agent:i,event:j,from:old[j],to:times[j],times,improvement};
  }
 }
 return best;
}
