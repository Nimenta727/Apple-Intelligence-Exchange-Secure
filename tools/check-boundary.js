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
if(!process.exitCode) console.log("Static boundary checks passed; NO claim of network isolation.");
