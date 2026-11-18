"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
const {run}=require("../src/core");
const {callDeepSeek,parseReply,parseStatus}=require("../src/deepseek");
const {candidateSse}=require("../src/sse");
const BASE={url:"https://prod-yabuli.qianwen.com/v1/sessions/responses",method:"POST",
  body:JSON.stringify({configuration:{response_configuration_group_id:"siri.tqa"},
  input:[{message:{content:[{type:"text",text:"什么是人工智能？"}]}}]})};
const KEY="LOCAL_TEST_KEY_NOT_A_SECRET";
function coreMock(opts={}) {
  const sent=[],responses=[];
  const rt={request:opts.request||BASE,done:r=>responses.push(r),
    store:{read:()=>opts.key===undefined?KEY:opts.key},
    httpClient:{post:options=>sent.push(options)}};
  const result=run(rt);
  return {sent,responses,result};
}
function providerMock(opts={}){
  const sent=[],results=[];
  let deferred;
  const client={post:(options,cb)=>{
    sent.push(options);
    if(opts.defer)deferred=cb;
    else cb(opts.error||null,opts.status||{status:200},
      opts.data===undefined?JSON.stringify({choices:[{message:{content:"人工智能是一种计算技术。"}}]}):opts.data);
  }};
  callDeepSeek(client,KEY,{prompt:"synthetic-only",scenario:"siri"},(error,answer)=>results.push({error,answer}));
  return {sent,results,fire:(err,resp,data)=>deferred(err,resp,data)};
}
function status(a){return a.responses[0].response.status;}
test("core refuses all model requests until network isolation is verified",()=>{
  const a=coreMock();
  assert.equal(a.sent.length,0);
  assert.equal(status(a),503);
  assert.equal(a.result.reason,"NETWORK_ISOLATION_UNVERIFIED");
});
test("provider adapter independently builds fixed HTTPS request",()=>{
  const a=providerMock();
  assert.equal(a.sent.length,1);
  assert.equal(a.sent[0].url,"https://api.deepseek.com/chat/completions");
  assert.equal(JSON.parse(a.sent[0].body).model,"deepseek-flash");
  assert.equal(a.results[0].error,null);
});
test("provider adapter does not echo the key in its answer",()=>{
  const a=providerMock();
  assert.ok(!JSON.stringify(a.results).includes(KEY));
});
test("invalid or oversized keys in core never enter Authorization headers",()=>{
  for(const key of ["line-one\nAuthorization: fake","space in key","a".repeat(300)]){
    const a=coreMock({key});assert.equal(a.sent.length,0);assert.equal(status(a),503);
  }
});
test("missing key and wrong path make no upstream request",()=>{
  for(const opts of [{key:""},{request:{...BASE,url:"https://prod-yabuli.qianwen.com/sair/config"}}]){
    const a=coreMock(opts);assert.equal(a.sent.length,0);assert.notEqual(status(a),200);
  }
});
test("provider adapter handles failure status, JSON, empty answer, and network error",()=>{
  for(const options of [
    {status:{status:401},data:'{"error":"no"}'},
    {status:{status:"HTTP/1.1 302 Found"},data:"redirect"},
    {data:"not json"},{data:JSON.stringify({choices:[{message:{content:null}}]})},
    {error:"network failure"}
  ]){
    const a=providerMock(options);
    assert.equal(a.results.length,1);
    assert.ok(a.results[0].error);
  }
});
test("provider callback remains testable independently of core transport gate",()=>{
  const a=providerMock({defer:true});
  assert.equal(a.results.length,0);
  a.fire(null,{status:200},JSON.stringify({choices:[{message:{content:"late"}}]}));
  assert.equal(a.results[0].answer,"late");
});
test("core cannot schedule timeouts or callbacks when provider is disabled",()=>{
  let scheduled=0;
  const a=[];const r=run({request:BASE,done:x=>a.push(x),store:{read:()=>KEY},
    setTimeout:()=>{scheduled++;return 1;},
    httpClient:{post:()=>{throw Error("upstream forbidden");}}});
  assert.equal(r.reason,"NETWORK_ISOLATION_UNVERIFIED");
  assert.equal(scheduled,0);
  assert.equal(a.length,1);
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
