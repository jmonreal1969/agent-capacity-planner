export const defaults={shift:8.5,contribution:100,supportModelVersion:2,ratio:10,acwLimit:90,dayMax:15000,dayStep:100,days:[7500,6800,6500,6200,5500],limits:{agents:[0,100,1,80],support:[0,100,1,8],shrink:[0,50,1,20],aht:[0,3000,1,300],acw:[0,10800,1,5400],calls:[0,150,1,60]}};
export const keys=['agents','support','shrink','aht','acw','calls'];
export function clamp(x,a,b){return Math.min(b,Math.max(a,x));}
export function snap(x,lim,up=false){return clamp(lim[0]+(up?Math.ceil:Math.round)((x-lim[0])/lim[2]-(up?1e-10:0))*lim[2],lim[0],lim[1]);}
export function metrics(v,c){const productive=Math.max(0,c.shift*3600-v.acw),available=Math.max(0,v.agents-v.shrink),reserve=v.support*c.contribution/100,scheduled=v.agents+reserve,fte=available+reserve,valid=v.aht>0,activePer=valid?productive/v.aht:0,per=scheduled>0?activePer*fte/scheduled:0;return {valid,productive,available,reserve,scheduled,activePer,per,fte,capacity:valid?Math.floor(activePer*fte+1e-9):0};}
export function solve(v,c,target,demand,field){const issues=[];if(demand===0){const values={...v,agents:c.limits.agents[0],support:c.limits.support[0],shrink:c.limits.shrink[0]};return {values,issues:['No staffing is required for zero demand. The calls target applies when agents are scheduled.']};}
let preferred=null,fallback=null;
for(let a=c.limits.agents[0];a<=c.limits.agents[1]+1e-9;a+=c.limits.agents[2]){
 const out={...v,agents:a,support:snap(c.ratio>0?Math.ceil(a/c.ratio):0,c.limits.support,true)},reserve=out.support*c.contribution/100,scheduled=a+reserve,available=Math.max(0,a-v.shrink)+reserve,shift=c.shift*3600;
 let wanted=NaN;
 if(field==='aht'&&target>0&&scheduled>0&&available>0)wanted=(shift-v.acw)*available/(scheduled*target);
 if(field==='acw'&&scheduled>0&&available>0)wanted=shift-target*scheduled*v.aht/available;
 if(field==='shrink'){const q=v.aht>0?Math.max(0,shift-v.acw)/v.aht:0;if(q>0)wanted=scheduled*(1-target/q);}
 const bounded=Number.isFinite(wanted)&&wanted>=c.limits[field][0]&&wanted<=c.limits[field][1]&&(field!=='shrink'||wanted<=a);
 if(Number.isFinite(wanted))out[field]=snap(wanted,c.limits[field]);
 const m=metrics(out,c),candidate={values:out,m,bounded,error:Math.abs(m.per-target)};
 if(m.capacity>=demand&&m.valid&&bounded){preferred=candidate;break;}
 if(!fallback||(m.capacity>=demand&&fallback.m.capacity<demand)||(m.capacity>=demand&&fallback.m.capacity>=demand&&candidate.error<fallback.error-1e-9)||(m.capacity<demand&&fallback.m.capacity<demand&&m.capacity>fallback.m.capacity))fallback=candidate;
}
const chosen=preferred||fallback||{values:{...v},m:metrics(v,c),bounded:false},out=chosen.values,m=chosen.m;
if(!m.valid)issues.push('Enter an AHT greater than zero.');
if(!chosen.bounded)issues.push('The calls target cannot be reached within the selected productivity limits.');
if(m.capacity<demand)issues.push('Demand exceeds available staffing at these settings.');
if(Math.abs(m.per-target)>.15)issues.push('Achievable calls per scheduled handler differ from the target; see the actual result.');
return {values:out,issues};}
export function dayStats(demand,m){const answered=Math.min(demand,m.capacity),shortfall=Math.max(0,demand-answered);return {answered,shortfall,percent:demand?shortfall/demand*100:0,coverage:demand?answered/demand*100:100};}
export function validate(c){if(!c||!Number.isFinite(c.shift)||c.shift<=0||c.shift>24)throw Error('Shift must be greater than 0 and at most 24 hours.');if(!Number.isFinite(c.contribution)||c.contribution<0||c.contribution>100||!Number.isFinite(c.ratio)||c.ratio<0)throw Error('Check support contribution and staffing ratio.');if(!Number.isInteger(c.dayMax)||c.dayMax<1||c.dayMax>10000000||!Number.isInteger(c.dayStep)||c.dayStep<1||c.dayStep>c.dayMax)throw Error('Check daily call range and step.');for(const k of keys){const l=c.limits?.[k];if(!Array.isArray(l)||l.length!==4||l.some(x=>!Number.isFinite(x))||l[0]<0||l[1]<=l[0]||l[2]<=0||l[2]>l[1]-l[0]||l[3]<l[0]||l[3]>l[1]||!l.every(Number.isInteger))throw Error('Check '+k+' limits: use whole numbers, min < max, and a valid step/default.');if(l[1]>(k==='aht'||k==='acw'?86400:10000))throw Error('Slider maximum is outside the allowed range.');}
if(!Number.isFinite(c.acwLimit)||c.acwLimit<0||c.acwLimit*60>c.limits.acw[1])throw Error('Daily ACW maximum must be within the ACW slider range.');
if(!Array.isArray(c.days)||c.days.length!==5||c.days.some(d=>!Number.isInteger(d)||d<0||d>c.dayMax))throw Error('Daily totals must be whole numbers within the daily range.');return c;}
export function migrateLegacy(data){const old=data.config;if(!old?.limits)throw Error('Invalid legacy configuration.');const config=JSON.parse(JSON.stringify(old));config.acwLimit=90;config.limits.shrink=[...defaults.limits.shrink];config.limits.acw=[...defaults.limits.acw];
const convert=values=>{const next={...values};next.shrink=snap(Math.round(values.agents*values.shrink/100),config.limits.shrink);next.acw=snap(values.aht+values.acw>0?config.shift*3600*values.acw/(values.aht+values.acw):0,config.limits.acw);return next;};
const oldDefaults=Object.fromEntries(keys.map(k=>[k,old.limits[k][3]])),newDefaults=convert(oldDefaults);config.limits.shrink[3]=newDefaults.shrink;config.limits.acw[3]=newDefaults.acw;validate(config);
const values=convert(data.values&&keys.every(k=>Number.isFinite(data.values[k]))?data.values:oldDefaults);
return {config,values,notice:'Saved settings converted: shrinkage is now unavailable agent headcount; ACW is now a daily total. Please review the converted values.'};}

export function upgradeSupportConfig(config){if(config.supportModelVersion===2)return config;return {...config,contribution:config.contribution===0||config.contribution===undefined?100:config.contribution,supportModelVersion:1};}
