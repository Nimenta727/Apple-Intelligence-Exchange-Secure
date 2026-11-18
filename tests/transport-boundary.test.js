"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Core=require("../src/core");
const Config=require("../src/config");
const request={url:"https://prod-yabuli.qianwen.com/v1/sessions/responses",
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({configuration:{response_configuration_group_id:"siri.tqa"},
  input:[{content:"SYNTHETIC_SIRI_TEST_CONTENT"}]})};
test("unverified transport refuses model calls even with a provisioned key",()=>{
  let calls=0,reads=0;const stages=[],responses=[];
  const ret=Core.run({request,done:x=>responses.push(x),trace:x=>stages.push(x),
    store:{read:()=>{reads++;return "synthetic_test_key_12345678";}},
    httpClient:{post:()=>{calls++;throw Error("must not be called");}}});
  assert.equal(Config.providerEnabled,false);
  assert.equal(ret.reason,"NETWORK_ISOLATION_UNVERIFIED");
  assert.equal(calls,0);
  assert.equal(reads,0);
  assert.equal(responses.length,1);
  assert.equal(responses[0].response.status,503);
  assert.match(responses[0].response.body,/AIES_NETWORK_ISOLATION_UNVERIFIED/);
  assert.deepEqual(stages,["ENTER","REQUEST_VALIDATED","NETWORK_ISOLATION_UNVERIFIED","LOCAL_ERROR_ATTEMPTED"]);
});
test("no mock response interface cannot send a model request",()=>{
  let calls=0;
  const ret=Core.run({request,httpClient:{post:()=>calls++},store:{read:()=>"synthetic_test_key_12345678"}});
  assert.equal(ret.reason,"NO_MOCK_INTERFACE");
  assert.equal(calls,0);
});
test("invalid targets remain denied before the transport check",()=>{
  let calls=0;const response=[];
  const ret=Core.run({request:{...request,url:"https://prod-yabuli.qianwen.com.evil.test/v1/sessions/responses"},
    done:x=>response.push(x),httpClient:{post:()=>calls++}});
  assert.equal(ret.reason,"DENIED_URL");
  assert.equal(response[0].response.status,422);
  assert.equal(calls,0);
});
