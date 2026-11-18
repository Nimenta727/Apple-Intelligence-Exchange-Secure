"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const script=fs.readFileSync(path.join(__dirname,"../scripts/aies_boundary_probe.js"),"utf8");
const moduleText=fs.readFileSync(path.join(__dirname,"../shadowrocket/20-AIES-LOCAL-BOUNDARY-PROBE.sgmodule"),"utf8");
function simulate(url,method) {
  const responses=[],labels=[];let outbound=0;
  vm.runInNewContext(script,{
    $request:{url,method},
    $done:r=>responses.push(r),
    $httpClient:{post:()=>{outbound++;throw Error("forbidden outbound");}},
    console:{log:s=>labels.push(s)}
  },{timeout:1000});
  return {responses,labels,outbound};
}
test("synthetic reserved HTTPS request returns local-only probe marker",()=>{
  const a=simulate("https://aies-probe.invalid/__aies_probe?case=1","GET");
  assert.equal(a.responses.length,1);
  assert.equal(a.responses[0].response.status,200);
  assert.equal(a.responses[0].response.body,"AIES_BOUNDARY_PROBE_OK");
  assert.equal(a.responses[0].response.headers["X-AIES-Boundary-Probe"],"synthetic-only");
  assert.equal(a.outbound,0);
  assert.deepEqual(a.labels,["[AIES_BOUNDARY] MOCK_ATTEMPTED"]);
});
test("probe script rejects method mismatch, wrong host, path or scheme",()=>{
  for(const [url,method] of [
    ["https://aies-probe.invalid/__aies_probe","POST"],
    ["https://aies-probe.invalid.attacker.test/__aies_probe","GET"],
    ["https://aies-probe.invalid/not-the-probe","GET"],
    ["http://aies-probe.invalid/__aies_probe","GET"]
  ]){
    const a=simulate(url,method);
    assert.equal(a.responses.length,1);
    assert.equal(a.responses[0].response.status,403);
    assert.equal(a.outbound,0);
  }
});
test("probe module DNS and DIRECT routing are restricted to synthetic host",()=>{
  assert.match(moduleText,/^aies-probe\.invalid\s*=\s*127\.0\.0\.1\s*$/m);
  const rules=moduleText.split("[Rule]")[1].split(/\n\[/)[0]
    .split("\n").map(s=>s.trim()).filter(s=>s && !s.startsWith("#"));
  assert.deepEqual(rules,["DOMAIN,aies-probe.invalid,DIRECT"]);
  assert.ok(!moduleText.includes("prod-yabuli.qianwen.com"));
  assert.ok(!moduleText.includes("api.deepseek.com"));
});
