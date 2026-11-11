import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {analyzeBusiness,validateBusinessInput} from '../analytics/report.js';
const fixture=JSON.parse(await readFile('examples/analytics.simulated.json','utf8')) as unknown;
const data=validateBusinessInput(fixture);
const original=data.records[0]!;
test('business analytics report never invents RPM or monetization for missing revenue',()=>{
 const r=analyzeBusiness(data);
 assert.equal(r.status,'SIMULATION_ONLY');
 assert.equal(r.decision,'INSUFFICIENT_EVIDENCE');
 assert.equal(r.rpmEur,null);
 assert.equal(r.costRecovered,null);
 assert.equal(r.episodes,1);
 assert.equal(r.overallCtrPercent,4.8);
 assert.equal(r.episodeEconomics[0]?.avgViewDurationSeconds,261);
});
test('recorded economics calculate observed RPM once and proper break-even views',()=>{
 const observed={...original,classification:'OBSERVED',evidenceReference:'youtube-studio-export-2026-11-11',metrics:{...original.metrics,estimatedRevenueEur:40}};
 const report=analyzeBusiness({...data,records:[observed]});
 assert.equal(report.status,'PRELIMINARY');
 assert.equal(report.rpmEur,2);
 assert.equal(report.episodeEconomics[0]?.totalCostEur,23.3);
 assert.equal(report.episodeEconomics[0]?.breakEvenViews,11650);
 assert.equal(report.episodeEconomics[0]?.localizedCoveragePercent,90);
});
test('rejects invented observed evidence, dishonest locale totals and over-100 CTR',()=>{
 assert.throws(()=>validateBusinessInput({...data,records:[{...original,classification:'OBSERVED'}]}),/source reference/);
 assert.throws(()=>validateBusinessInput({...data,records:[{...original,metrics:{...original.metrics,byLocale:[{locale:'es-ES',views:30000}]}}]}),/exceed aggregate/);
 assert.throws(()=>validateBusinessInput({...data,records:[{...original,metrics:{...original.metrics,impressionsCtrPercent:101}}]}),/CTR/);
 assert.throws(()=>validateBusinessInput({...data,records:[original,original]}),/Duplicate/);
 assert.throws(()=>validateBusinessInput({...data,records:[{...original,metrics:{...original.metrics,estimatedRevenueEur:30}}]}),/Simulated revenue/);
});
