"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const text=fs.readFileSync(path.join(__dirname,"../shadowrocket/21-AIES-HTTP-ENGINE-PROBE.sgmodule"),"utf8");
test("fake IP probe is scoped to a reserved .invalid host",()=>{
  assert.match(text,/^aies-probe\.invalid\s*=\s*198\.18\.41\.221$/m);
  assert.match(text,/^force-http-engine-hosts\s*=\s*%APPEND%\s+aies-probe\.invalid$/m);
  assert.match(text,/^DOMAIN,aies-probe\.invalid,DIRECT$/m);
  assert.match(text,/^hostname\s*=\s*%APPEND%\s+aies-probe\.invalid$/m);
  assert.ok(text.includes("script-path=Script/aies_boundary_probe.js"));
  for(const forbidden of ["prod-yabuli.qianwen.com","api.deepseek.com","DOMAIN-SUFFIX,","FINAL,DIRECT"])
    assert.ok(!text.includes(forbidden));
});
test("fake-IP and loopback probe configurations cannot be mistaken for production Siri modules",()=>{
  const live=fs.readFileSync(path.join(__dirname,"../shadowrocket/10-SAIRS-DEEPSEEK-LAB.sgmodule"),"utf8");
  assert.match(live,/DOMAIN,prod-yabuli\.qianwen\.com,REJECT/);
  assert.doesNotMatch(live,/force-http-engine-hosts|198\.18\.41\.221|aies-probe\.invalid/);
});
