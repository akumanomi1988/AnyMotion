/** Evidence-aware, privacy-free local reporting. Never infers YouTube monetization or channel acceptance. */
export interface CostLedger {
  llmEur:number; ttsEur:number; renderEur:number; storageEur:number;
  licensesEur:number; editorialEur:number; overheadEur:number;
}
export interface ObservedMetrics {
  views:number;impressions:number;impressionsCtrPercent:number|null;
  watchTimeHours:number;uniqueViewers:number|null;returningViewers:number|null;
  estimatedRevenueEur:number|null;
  byLocale:{locale:string;views:number}[];
}
export interface EpisodeObservation {
  episodeId:string; durationSeconds:number; classification:'OBSERVED'|'SIMULATED';
  dataThrough:string; evidenceReference:string|null;
  metrics:ObservedMetrics; costs:CostLedger;
}
export interface BusinessInput {schemaVersion:'1.0';seriesId:string;records:EpisodeObservation[]}
export interface EpisodeEconomics {episodeId:string;classification:'OBSERVED'|'SIMULATED';
 totalCostEur:number;views:number;observedRevenueEur:number|null;
 rpmEur:number|null;costPerThousandViewsEur:number|null;
 avgViewDurationSeconds:number|null;avgPercentageViewed:number|null;
 impressionsCtrPercent:number|null;returningViewerRatio:number|null;
 costRecovered:boolean|null;breakEvenViews:number|null;
 localizedCoveragePercent:number|null;
}
export interface BusinessReport {schemaVersion:'1.0';seriesId:string;status:'SIMULATION_ONLY'|'PRELIMINARY'|'OBSERVED_PILOT';
 episodes:number;views:number;totalCostEur:number;observedRevenueEur:number|null;rpmEur:number|null;
 overallCtrPercent:number|null;avgViewDurationSeconds:number|null;costRecovered:boolean|null;
 decision:'INSUFFICIENT_EVIDENCE';episodeEconomics:EpisodeEconomics[];
 caveats:string[];
}
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x);
function exact(x:Record<string,unknown>,keys:string[]):boolean {return Object.keys(x).sort().join(',')===keys.sort().join(',');}
function money(x:unknown,label:string):number{
 if(typeof x!=='number'||!Number.isFinite(x)||x<0||x>1e9)throw new Error(`Invalid monetary amount: ${label}`);return x;
}
function counter(x:unknown,label:string):number{
 if(typeof x!=='number'||!Number.isSafeInteger(x)||x<0||x>1e12)throw new Error(`Invalid nonnegative counter: ${label}`);return x;
}
function optionalMoney(x:unknown,label:string):number|null{return x===null?null:money(x,label);}
function optionalCounter(x:unknown,label:string):number|null{return x===null?null:counter(x,label);}
const decimals=(n:number)=>Math.round((n+Number.EPSILON)*100)/100;
const ratio=(a:number,b:number):number|null=>b>0?decimals(a/b):null;
export function validateBusinessInput(input:unknown):BusinessInput{
 if(!obj(input)||!exact(input,['schemaVersion','seriesId','records'])||input.schemaVersion!=='1.0'||
  typeof input.seriesId!=='string'||!/^[a-zA-Z][a-zA-Z0-9_-]{2,63}$/.test(input.seriesId)||
  !Array.isArray(input.records)||input.records.length<1||input.records.length>150)throw new Error('Invalid analytics input schema');
 const ids=new Set<string>();
 for(const [i,item] of input.records.entries()){
  if(!obj(item)||!exact(item,['episodeId','durationSeconds','classification','dataThrough','evidenceReference','metrics','costs']))
   throw new Error(`Invalid observation object ${i}`);
  if(typeof item.episodeId!=='string'||!/^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(item.episodeId)||ids.has(item.episodeId))
   throw new Error('Duplicate or invalid episode observation');
  ids.add(item.episodeId);
  if(item.classification!=='OBSERVED'&&item.classification!=='SIMULATED')throw new Error('Observation classification required');
  if(typeof item.durationSeconds!=='number'||!Number.isSafeInteger(item.durationSeconds)||item.durationSeconds<60||item.durationSeconds>3600)
   throw new Error('Invalid episode duration');
  if(typeof item.dataThrough!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(item.dataThrough)||
    new Date(`${item.dataThrough}T00:00:00.000Z`).toISOString().slice(0,10)!==item.dataThrough)
   throw new Error('Invalid dataThrough date');
  if(item.classification==='OBSERVED'&&(typeof item.evidenceReference!=='string'||item.evidenceReference.trim().length<8||item.evidenceReference.length>200))
   throw new Error('Observed data requires a verifiable source reference');
  if(item.classification==='SIMULATED'&&item.evidenceReference!==null)throw new Error('Simulated inputs cannot pretend to have evidence');
  if(!obj(item.metrics)||!exact(item.metrics,['views','impressions','impressionsCtrPercent','watchTimeHours','uniqueViewers','returningViewers','estimatedRevenueEur','byLocale']))
   throw new Error('Invalid YouTube metrics schema');
  const m=item.metrics;
  const views=counter(m.views,'views'),impressions=counter(m.impressions,'impressions');
  const ctr=m.impressionsCtrPercent;
  if(ctr!==null&&(typeof ctr!=='number'||!Number.isFinite(ctr)||ctr<0||ctr>100))throw new Error('CTR outside 0–100%');
  if(ctr!==null&&impressions===0)throw new Error('Cannot report impression CTR without impressions');
  if(typeof m.watchTimeHours!=='number'||!Number.isFinite(m.watchTimeHours)||m.watchTimeHours<0||m.watchTimeHours>1e12)
   throw new Error('Invalid watch time');
  const unique=optionalCounter(m.uniqueViewers,'unique viewers');
  const returning=optionalCounter(m.returningViewers,'returning viewers');
  if(unique!==null&&unique>views)throw new Error('Unique viewers exceed views');
  if(returning!==null&&(returning>views||(unique!==null&&returning>unique)))throw new Error('Returning viewers exceed audience');
  optionalMoney(m.estimatedRevenueEur,'revenue');
  if(item.classification==='SIMULATED'&&m.estimatedRevenueEur!==null)throw new Error('Simulated revenue cannot be labeled observed');
  if(!Array.isArray(m.byLocale)||m.byLocale.length>30)throw new Error('Invalid language breakdown');
  let listedViews=0;const locales=new Set<string>();
  for(const loc of m.byLocale){
   if(!obj(loc)||!exact(loc,['locale','views'])||typeof loc.locale!=='string'||
    !/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(loc.locale)||locales.has(loc.locale))throw new Error('Invalid language locale');
   locales.add(loc.locale);listedViews+=counter(loc.views,'language views');
  }
  if(listedViews>views)throw new Error('Language views exceed aggregate views');
  if(!obj(item.costs)||!exact(item.costs,['llmEur','ttsEur','renderEur','storageEur','licensesEur','editorialEur','overheadEur']))
   throw new Error('Invalid cost categories');
  for(const [name,value] of Object.entries(item.costs))money(value,`cost ${name}`);
 }
 return input as unknown as BusinessInput;
}
function costSum(costs:CostLedger):number{return Object.values(costs).reduce((sum,value)=>sum+value,0);}
/** Revenue is observed input or NULL. A video count alone never proves demand or monetization. */
export function analyzeBusiness(input:unknown):BusinessReport{
 const series=validateBusinessInput(input);
 const episodes:EpisodeEconomics[]=series.records.map(row=>{
  const m=row.metrics,cost=costSum(row.costs),revenue=m.estimatedRevenueEur;
  const rpm=revenue===null?null:ratio(revenue*1000,m.views);
  const avg=ratio(m.watchTimeHours*3600,m.views);
  const localeSum=m.byLocale.reduce((sum,l)=>sum+l.views,0);
  return {episodeId:row.episodeId,classification:row.classification,totalCostEur:decimals(cost),views:m.views,
   observedRevenueEur:revenue===null?null:decimals(revenue),rpmEur:rpm,costPerThousandViewsEur:ratio(cost*1000,m.views),
   avgViewDurationSeconds:avg,avgPercentageViewed:avg===null?null:decimals(100*avg/row.durationSeconds),
   impressionsCtrPercent:m.impressionsCtrPercent,returningViewerRatio:m.returningViewers===null||m.uniqueViewers===null?null:ratio(m.returningViewers,m.uniqueViewers),
   costRecovered:revenue===null?null:revenue>=cost,breakEvenViews:rpm!==null&&rpm>0?Math.ceil(1000*cost/rpm):null,
   localizedCoveragePercent:m.byLocale.length===0?null:ratio(localeSum*100,m.views)};
 });
 const totalViews=series.records.reduce((sum,x)=>sum+x.metrics.views,0),totalCost=decimals(episodes.reduce((sum,x)=>sum+x.totalCostEur,0));
 const observed=series.records.filter(x=>x.classification==='OBSERVED');
 const fullRevenue=series.records.every(x=>x.classification==='OBSERVED'&&x.metrics.estimatedRevenueEur!==null);
 const revenue=fullRevenue?decimals(series.records.reduce((sum,x)=>sum+(x.metrics.estimatedRevenueEur??0),0)):null;
 const impressions=series.records.filter(x=>x.metrics.impressionsCtrPercent!==null).reduce((sum,x)=>sum+x.metrics.impressions,0);
 const weightedCtr=impressions>0?decimals(series.records.reduce((sum,x)=>sum+x.metrics.impressions*(x.metrics.impressionsCtrPercent??0),0)/impressions):null;
 const status=observed.length===0?'SIMULATION_ONLY':observed.length>=6&&observed.length===series.records.length?'OBSERVED_PILOT':'PRELIMINARY';
 return {schemaVersion:'1.0',seriesId:series.seriesId,status,episodes:series.records.length,views:totalViews,
  totalCostEur:totalCost,observedRevenueEur:revenue,rpmEur:revenue===null?null:ratio(revenue*1000,totalViews),
  overallCtrPercent:weightedCtr,avgViewDurationSeconds:ratio(series.records.reduce((sum,x)=>sum+x.metrics.watchTimeHours*3600,0),totalViews),
  costRecovered:revenue===null?null:revenue>=totalCost,
  decision:'INSUFFICIENT_EVIDENCE',episodeEconomics:episodes,
  caveats:[
   'Revenue is an input from the operator, not inferred by AnyMotion. RPM is estimatedRevenue / totalViews * 1000.',
   'No causal claim about dubbing revenue can be made from language-view shares alone.',
   'CTR uses the platform-reported impressions CTR, not views divided by impressions.',
   'No automatic SCALE/STOP conclusion: human review requires observed audience data and sufficient sample.'
  ]};
}
