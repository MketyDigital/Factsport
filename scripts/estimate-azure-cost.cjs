'use strict';
// Factsport 2.0 - transparent Azure monthly planning estimator.
// No Azure SDK, network calls, credentials, or billing operations.
// Usage examples: node scripts/estimate-azure-cost.cjs
// ENTRA_OVERAGE_USD_PER_MAU=... node scripts/estimate-azure-cost.cjs
const D=30, minutes=60*24*D;
const hourlyCompute=12.41, storage=32*0.115, db=hourlyCompute+storage;
const RATE_BUILTIN=0.000025, FREE_BUILTIN=4000, RATE_STANDARD=0.000125, RATE_ENTERPRISE=0.001;
function estimate({ dbSyncPerMin=1, fiveMinJobs=1, dailyWorkflows=8, dailyActionsEach=3, standardCalls=0, enterpriseCalls=0, mau=5000, entraOverageUsdPerMau=null, distinctActionsPerSync=1, distinctActionsPerFiveMin=3 }) {
  const oneMinuteRuns=Math.floor(minutes*dbSyncPerMin);
  const fiveRuns=Math.floor(minutes/5)*fiveMinJobs;
  const dailyRuns=D*dailyWorkflows;
  const triggerExecutions=oneMinuteRuns+fiveRuns+dailyRuns;
  const builtInActions=oneMinuteRuns*distinctActionsPerSync+fiveRuns*distinctActionsPerFiveMin+dailyRuns*dailyActionsEach;
  // Treat triggers conservatively as additional chargeable executions.
  const billableBuiltIn=Math.max(0,triggerExecutions+builtInActions-FREE_BUILTIN);
  const logicBuiltIn=billableBuiltIn*RATE_BUILTIN;
  const connectorFees=standardCalls*RATE_STANDARD+enterpriseCalls*RATE_ENTERPRISE;
  const overageCount=Math.max(0,mau-50000);
  const entra=entraOverageUsdPerMau===null?(overageCount>0?null:0):overageCount*entraOverageUsdPerMau;
  return { mau, db:Number(db.toFixed(2)), perMonth:{
    oneMinuteRuns,fiveRuns,dailyRuns,triggerExecutions,builtInActions,billableBuiltIn,
    logicBuiltIn:+logicBuiltIn.toFixed(2), connectorFees:+connectorFees.toFixed(2),
    logicTotal:+(logicBuiltIn+connectorFees).toFixed(2),
    entraBasic:entra===null?'SUBSCRIPTION QUOTE REQUIRED':+entra.toFixed(2),
    azureSubtotal:entra===null?'SUBSCRIPTION QUOTE REQUIRED':+(db+logicBuiltIn+connectorFees+entra).toFixed(2)
  }};
}
const scenarios={
  lean:{ dbSyncPerMin:0, fiveMinJobs:1, dailyWorkflows:6, dailyActionsEach:3, distinctActionsPerFiveMin:3, mau:1500 },
  moderate:{ dbSyncPerMin:1, fiveMinJobs:1, dailyWorkflows:8, dailyActionsEach:3, distinctActionsPerFiveMin:3, mau:10000 },
  busy:{ dbSyncPerMin:1, fiveMinJobs:2, dailyWorkflows:16, dailyActionsEach:5, distinctActionsPerFiveMin:4, standardCalls:3000, mau:40000 }
};
const overageRate=process.env.ENTRA_OVERAGE_USD_PER_MAU==null?null:Number(process.env.ENTRA_OVERAGE_USD_PER_MAU);
if(overageRate!==null&&(!Number.isFinite(overageRate)||overageRate<0))throw new Error('Invalid ENTRA_OVERAGE_USD_PER_MAU');
for(const [name, scenario] of Object.entries(scenarios)){
 console.log(name.toUpperCase(),JSON.stringify(estimate({...scenario,entraOverageUsdPerMau:overageRate}),null,2));
}
console.log('Notes: 30-day model; charges approximate, not subscription quote; built-in triggers counted conservatively; retries/failures, log retention, API and R2, email, AI, data egress, backups and taxes EXCLUDED. Monthly MAU free allowance may aggregate across linked tenants.');
module.exports={estimate};
