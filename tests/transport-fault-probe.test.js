"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");

const root=path.resolve(__dirname,"..");
const script=fs.readFileSync(path.join(root,"scripts/aies_transport_fault_probe.js"),"utf8");
const direct=fs.readFileSync(path.join(root,"shadowrocket/30-AIES-TRANSPORT-FAULT-DIRECT.sgmodule"),"utf8");
const reject=fs.readFileSync(path.join(root,"shadowrocket/31-AIES-TRANSPORT-FAULT-REJECT.sgmodule"),"utf8");
function run(url,method="GET"){
  const responses=[], logs=[];
  const ctx={$request:{url,method},$done:value=>responses.push(value),
    console:{log:value=>logs.push(value)}};
  let error=null;
  try{vm.runInNewContext(script,ctx,{timeout:1000});}catch(e){error=e;}
  return {responses,logs,error};
}
const url=m=>"https://aies-probe.invalid/__aies_fault?case="+m;
test("synthetic probe produces fixed local successful and error responses",()=>{
  for (const [mode,status,body] of [["ok",200,"AIES_FAULT_OK"],["deny",503,"AIES_FAULT_DENIED"]]){
    const r=run(url(mode));assert.equal(r.error,null);
    assert.equal(r.responses.length,1);
    assert.equal(r.responses[0].response.status,status);
    assert.equal(r.responses[0].response.body,body);
  }
});
test("deliberate failures never call done or any network client",()=>{
  const thrown=run(url("throw"));assert.equal(thrown.responses.length,0);
  assert.match(String(thrown.error),/AIES_SYNTHETIC_THROW/);
  const hung=run(url("nodone"));assert.equal(hung.error,null);
  assert.equal(hung.responses.length,0);
});
test("invalid requests are denied without echoing user-provided input",()=>{
  for(const [u,m] of [[url("bad"),"GET"],[url("ok"),"POST"],["https://prod-yabuli.qianwen.com/__aies_fault?case=ok","GET"]]){
    const r=run(u,m);assert.equal(r.error,null);
    assert.equal(r.responses[0].response.status,403);
    assert.equal(r.responses[0].response.body,"AIES_FAULT_INVALID");
  }
});
test("modules restrict to reserved host and mutually exclusive route actions",()=>{
  assert.match(direct,/aies-probe\.invalid = 127\.0\.0\.1/);
  assert.match(direct,/DOMAIN,aies-probe\.invalid,DIRECT/);
  assert.match(reject,/DOMAIN,aies-probe\.invalid,REJECT/);
  for(const module of [direct,reject]){
    assert.match(module,/Script\/aies_transport_fault_probe\.js/);
    assert.ok(!module.includes("prod-yabuli.qianwen.com"));
    assert.ok(!module.includes("api.deepseek.com"));
  }
});
