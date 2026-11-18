"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
const {run}=require("../src/core");
const {parseReply,parseStatus}=require("../src/deepseek");
const {candidateSse}=require("../src/sse");
const BASE={url:"https://prod-yabuli.qianwen.com/v1/sessions/responses",method:"POST",
  body:JSON.stringify({configuration:{response_configuration_group_id:"siri.tqa"},
  input:[{message:{content:[{type:"text",text:"什么是人工智能？"}]}}]})};
const KEY="LOCAL_TEST_KEY_NOT_A_SECRET";
function mock(opts={}){
  const sent=[],responses=[],timers=[];
  let deferred=null;
  const rt={
    request:opts.request||BASE,
    done:r=>responses.push(r),
    store:{read:()=>opts.key===undefined?KEY:opts.key},
    setTimeout:f=>{timers.push(f);return timers.length;},clearTimeout:()=>{},
    httpClient:{post:(options,cb)=>{
      sent.push(options);
      if(opts.defer)deferred=cb;
      else cb(opts.error||null,opts.status||{status:200},
        opts.data===undefined?JSON.stringify({choices:[{message:{content:"人工智能是一种计算技术。"}}]}):opts.data);
    }},
    clock:{now:()=>1700000000000,id:()=> "testid"}
  };
  run(rt);
  return {sent,responses,timers,fire:(err,resp,data)=>deferred(err,resp,data)};
}
function status(x){return x.responses[0].response.status;}
test("normal request uses fixed HTTPS provider and candidate SSE",()=>{
  const a=mock();assert.equal(a.sent.length,1);
  assert.equal(a.sent[0].url,"https://api.deepseek.com/chat/completions");
  assert.equal(JSON.parse(a.sent[0].body).model,"deepseek-flash");
  assert.equal(status(a),200);
  assert.match(a.responses[0].response.body,/event: session.response.done/);
});
test("never echoes a key or persists user text",()=>{
  const a=mock();
  assert.ok(!JSON.stringify(a.responses).includes(KEY));
  assert.ok(!JSON.stringify(a.responses).includes("Authorization"));
});
test("missing key and wrong path make no upstream request",()=>{
  for(const opts of [{key:""},{request:{...BASE,url:"https://prod-yabuli.qianwen.com/sair/config"}}]){
    const a=mock(opts);assert.equal(a.sent.length,0);assert.notEqual(status(a),200);
  }
});
test("status, invalid JSON, empty answer, network error fail closed",()=>{
  for(const x of [
    {status:{status:401},data:'{"error":"no"}'},
    {status:{status:"HTTP/1.1 302 Found"},data:"redirect"},
    {data:"not json"},{data:JSON.stringify({choices:[{message:{content:null}}]})},
    {error:"network failure"}
  ]){
    const a=mock(x);assert.equal(a.responses.length,1);assert.notEqual(status(a),200);
  }
});
test("timeout completes exactly once, ignoring late success",()=>{
  const a=mock({defer:true});assert.equal(a.responses.length,0);
  a.timers[0]();assert.equal(status(a),504);
  a.fire(null,{status:200},JSON.stringify({choices:[{message:{content:"late"}}]}));
  assert.equal(a.responses.length,1);
});
test("double callback cannot send two synthetic responses",()=>{
  const a=mock({defer:true});
  const json=JSON.stringify({choices:[{message:{content:"你好"}}]});
  a.fire(null,{status:200},json);a.fire(null,{status:200},json);
  assert.equal(a.responses.length,1);
});
test("no mock-response interface means no model call",()=>{
  let count=0;
  const result=run({request:BASE,done:null,httpClient:{post:()=>count++},store:{read:()=>KEY}});
  assert.equal(count,0);assert.equal(result.started,false);
});
test("provider status parsing is bounded",()=>{
  assert.equal(parseStatus({status:"HTTP/1.1 200 OK"}),200);
  assert.equal(parseStatus({statusCode:429}),429);
  assert.equal(parseReply(500,'{"error":"broken"}').ok,false);
});
test("all 12 SSE events contain JSON with names",()=>{
  const s=candidateSse("你好","提示","siri",{now:()=>1700000000000,id:()=> "abc"});
  const events=s.trim().split("\n\n");
  assert.equal(events.length,12);
  for(const block of events){
    const lines=block.split("\n");
    assert.match(lines[0],/^event: /);
    const payload=JSON.parse(lines[1].replace(/^data: /,""));
    assert.equal(typeof payload.type,"string");
  }
});
test("generated single-file bundle supports missing key failure",()=>{
  const bundle=fs.readFileSync(path.join(__dirname,"../scripts/sairs_router.js"),"utf8");
  const responses=[];
  vm.runInNewContext(bundle,{$request:BASE,$done:r=>responses.push(r),
    $persistentStore:{read:()=>""},$httpClient:{post:()=>{throw Error("network must not be called");}},
    setTimeout:()=>0,clearTimeout:()=>{}},{timeout:2000});
  assert.equal(responses[0].response.status,503);
});
