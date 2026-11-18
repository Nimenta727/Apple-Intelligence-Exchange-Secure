#!/usr/bin/env node
"use strict";
// Static release barrier. This cannot prove network behavior or VPN isolation.
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const moduleText=read("shadowrocket/10-SAIRS-DEEPSEEK-LAB.sgmodule");
const baseline=read("shadowrocket/00-SAIRS-LOCKDOWN.sgmodule");
const config=require("../src/config");
const fail=msg=>{console.error("AIES boundary check failed: "+msg);process.exitCode=1;};
const exactRule=/^DOMAIN,prod-yabuli\.qianwen\.com,REJECT\s*$/m;
if(!exactRule.test(moduleText)) fail("experimental module lost exact REJECT rule");
if(!exactRule.test(baseline)) fail("lockdown module lost exact REJECT rule");
if(!/type=http-request/.test(moduleText) || !/requires-body=true/.test(moduleText))
  fail("experimental request interception missing");
if(config.providerEnabled!==false) fail("unverified lab must never enable DeepSeek calls");
if(/\bprod-yabuli\.qianwen\.com,DIRECT\b/.test(moduleText))
  fail("dangerous direct routing to original provider");
if(/\btype=http-response\b/.test(moduleText))
  fail("unsafe upstream-response passthrough pattern detected in experimental module");
const probe=read("shadowrocket/20-AIES-LOCAL-BOUNDARY-PROBE.sgmodule");
const probeScript=read("scripts/aies_boundary_probe.js");
if(!/^aies-probe\.invalid\s*=\s*127\.0\.0\.1\s*$/m.test(probe))
  fail("probe must map reserved host to loopback");
const matchRule=probe.match(/\[Rule\]([\s\S]*?)(?:\n\[|$)/);
const rules=matchRule ? matchRule[1].split("\n").map(s=>s.trim())
  .filter(s=>s && !s.startsWith("#")) : [];
if(JSON.stringify(rules)!==JSON.stringify(["DOMAIN,aies-probe.invalid,DIRECT"]))
  fail("probe must route ONLY the reserved host DIRECT");
if(!/hostname\s*=\s*%APPEND%\s+aies-probe\.invalid/.test(probe))
  fail("probe MITM must be limited to reserved host");
if(!/script-path=Script\/aies_boundary_probe\.js/.test(probe) ||
   !/type=http-request/.test(probe))
  fail("probe script configuration mismatch");
if(/prod-yabuli\.qianwen\.com|api\.deepseek\.com/.test(probe+probeScript))
  fail("probe must not reference real Siri or DeepSeek hosts");
if(/\$httpClient|\$task\.fetch|XMLHttpRequest|fetch\s*\(/.test(probeScript))
  fail("probe must not attempt network requests");
if(!process.exitCode) console.log("Static boundary checks passed; NO claim of network isolation.");
