#!/usr/bin/env node
"use strict";
// Synthetic-only evidence evaluation. No packets, prompts or secrets are accepted.
const fs=require("node:fs");
function evaluate(data){
  if (!data || data.testHost!=="aies-probe.invalid") return {status:"INVALID",reason:"WRONG_OR_MISSING_TEST_HOST"};
  if (data.nonLoopbackOutboundObserved===true) return {status:"FAIL",reason:"NON_LOOPBACK_OUTBOUND_OBSERVED"};
  if (data.scriptBody!=="AIES_BOUNDARY_PROBE_OK") return {status:"INCONCLUSIVE",reason:"NO_LOCAL_MOCK"};
  if (data.hostMapping!=="127.0.0.1") return {status:"INCONCLUSIVE",reason:"MAPPING_UNCONFIRMED"};
  if (data.independentNetworkObservation!==true) return {status:"INCONCLUSIVE",reason:"NO_INDEPENDENT_NETWORK_EVIDENCE"};
  if (data.nonLoopbackOutboundObserved!==false) return {status:"INCONCLUSIVE",reason:"OUTBOUND_NOT_MEASURED"};
  return {status:"PROBE_PASS",scope:"SYNTHETIC_DOMAIN_ONLY",siriReady:false};
}
if(require.main===module){
  const path=process.argv[2];
  if (!path) {console.error("Usage: node tools/evaluate-boundary.js <sanitized-evidence.json>");process.exit(2);}
  try {
    const data=JSON.parse(fs.readFileSync(path,"utf8"));
    const result=evaluate(data);
    console.log(JSON.stringify(result));
    if (result.status!=="PROBE_PASS") process.exitCode=1;
  } catch(e) {console.error("Invalid evidence file");process.exitCode=2;}
}
module.exports={evaluate};
