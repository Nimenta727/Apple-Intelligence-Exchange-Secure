"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Core=require("../src/core");
function run(request, store) {
  const events=[];const responses=[];let calls=0;
  const result=Core.run({request,trace:x=>events.push(x),done:x=>responses.push(x),
    store:{read:()=>store||""},httpClient:{post:()=>{calls++;}}});
  return {events,responses,calls,result};
}
test("diagnostics contain only stable stage markers; missing key never calls upstream",()=>{
  const secret="SECRET_PROMPT_DO_NOT_LOG";
  const request={url:"https://prod-yabuli.qianwen.com/v1/sessions/responses",method:"POST",
    headers:{"Content-Type":"application/json"},body:JSON.stringify({
      configuration:{response_configuration_group_id:"siri.tqa"},
      input:[{content:secret}]})};
  const o=run(request,"");
  assert.deepEqual(o.events,["ENTER","REQUEST_VALIDATED","KEY_MISSING","LOCAL_ERROR_ATTEMPTED"]);
  assert.equal(o.calls,0);
  assert.equal(o.responses.length,1);
  assert.equal(o.responses[0].response.status,503);
  assert.ok(!JSON.stringify(o.events).includes(secret));
});
test("invalid request is rejected before any API call",()=>{
  const o=run({url:"https://invalid.example/",method:"GET"});
  assert.deepEqual(o.events,["ENTER","REQUEST_REJECTED","LOCAL_ERROR_ATTEMPTED"]);
  assert.equal(o.calls,0);
  assert.equal(o.responses[0].response.status,422);
});
test("missing mock interface never sends upstream",()=>{
  let sent=false;const events=[];
  const r=Core.run({trace:x=>events.push(x),httpClient:{post:()=>sent=true}});
  assert.equal(r.reason,"NO_MOCK_INTERFACE");
  assert.equal(sent,false);
  assert.deepEqual(events,["ENTER","NO_MOCK_INTERFACE"]);
});

test("a failing response callback logs DONE_THROW but never retries with a passthrough",()=>{
  const events=[];let doneCalls=0;let upstreamCalls=0;
  const r=Core.run({request:{url:"https://wrong.example/",method:"POST"},trace:s=>events.push(s),
    done:()=>{doneCalls++;throw Error("local delivery failed");},
    httpClient:{post:()=>{upstreamCalls++;}}});
  assert.equal(r.started,false);
  assert.equal(doneCalls,1);
  assert.equal(upstreamCalls,0);
  assert.deepEqual(events,["ENTER","REQUEST_REJECTED","LOCAL_ERROR_ATTEMPTED","DONE_THROW"]);
});
test("missing HTTP client fails closed before attempting upstream",()=>{
  const events=[];const outputs=[];
  const request={url:"https://prod-yabuli.qianwen.com/v1/sessions/responses",method:"POST",
    body:JSON.stringify({configuration:{response_configuration_group_id:"siri.tqa"},
    input:[{content:"hello"}]})};
  const r=Core.run({request,trace:x=>events.push(x),done:v=>outputs.push(v),
    store:{read:()=>"fake_test_key_123456789"},httpClient:null});
  assert.equal(r.reason,"HTTP_CLIENT_MISSING");
  assert.equal(outputs.length,1);
  assert.equal(outputs[0].response.status,503);
  assert.deepEqual(events,["ENTER","REQUEST_VALIDATED","HTTP_CLIENT_MISSING","LOCAL_ERROR_ATTEMPTED"]);
});
