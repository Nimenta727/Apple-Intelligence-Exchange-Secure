"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const Sse=require("./fixtures/siri-sse");
const code=fs.readFileSync(path.join(__dirname,"../scripts/aies_siri_deepseek_v07_request_first.js"),"utf8");
const mod=fs.readFileSync(path.join(__dirname,"../shadowrocket/63-AIES-SIRI-DEEPSEEK-V07-REQUEST-FIRST-LOCAL.sgmodule"),"utf8");
const URL="https://prod-yabuli.qianwen.com/v1/sessions/responses";
const prompt="Where is Saturn?";
const key="sk_fake_test_12345678901234567890";
function initialBody(group="siri.multimodal.noRTI",question=prompt){
 return JSON.stringify({configuration:{response_configuration_group_id:group},
  input:[{type:"message",message:{role:"user",content:[{type:"text",text:question}]}}],
  stream:true,client_tools:[],server_tools:[],response_format:{type:"text"}});
}
function createEnv(options={}){
 const data={SAIRS_DEEPSEEK_API_KEY:key},logs=[],requests=[];
 const invoke=(request,client)=>{
  let result=[];
  const ctx={$request:request,$persistentStore:{
   read:k=>data[k]||null,write:(v,k)=>{data[k]=v;return true;}
  },$httpClient:client||{post:(opts,cb)=>{
   requests.push(opts);
   cb(null,{statusCode:200},JSON.stringify({
    choices:[{finish_reason:"stop",message:{content:"DEEPSEEK_ANSWER"}}]}));
  }},$done:v=>result.push(v),Date,Math,
   console:{log:v=>logs.push(v)},
   setTimeout:()=>17,clearTimeout:()=>{}};
  vm.runInNewContext(code,ctx,{timeout:1000});
  assert.equal(result.length,1,"request hook must $done exactly once");
  return result[0];
 };
 const request=(body=initialBody(),url=URL,ua="Siri (iPad - Version 27.3.0)")=>({
  url,method:"POST",body,headers:{"User-Agent":ua,"Content-Type":"application/json"}
 });
 return {data,logs,requests,invoke,request};
}
function extract(body,name){
 const f=body.split("\n\n").find(x=>x.startsWith("event: "+name+"\n"));
 assert.ok(f,"expected SSE "+name);
 const payload=JSON.parse(f.split("\n").find(x=>x.startsWith("data: ")).slice(6));
 return payload[name];
}
function followupBody(group="siri.multimodal.noRTI",question="Why is it that color?",pointer=undefined){
 const obj=JSON.parse(initialBody(group,question));
 if(pointer!==undefined)obj.previous_choice_id=pointer;
 return JSON.stringify(obj);
}
test("failed 63 is quarantined with disabled request hooks and zero response hooks",()=>{
 const hooks=mod.split("\n").filter(x=>x.startsWith("AIES63 "));
 assert.equal(hooks.length,2);
 assert.ok(hooks.every(x=>x.includes("type=http-request")));
 assert.ok(hooks.every(x=>x.endsWith(",script-path=Script/aies_siri_deepseek_v07_request_first.js,enable=false")));
 assert.equal(mod.includes("type=http-response"),false);
 assert.equal(mod.includes("script-path=https://"),false);
 assert.match(mod,/NEVER together/);
 assert.match(mod,/QUARANTINED/);
 assert.match(mod,/KNOWN REAL-DEVICE FAILURE/);
 assert.match(code,/version:"0.7.0-request-first-experimental"/);
});
test("first Siri question returns validated local SSE with DeepSeek attribution, no upstream tag or Qwen body",()=>{
 const e=createEnv(),r=e.invoke(e.request());
 assert.equal(r.response.status,200);
 assert.equal(r.headers,undefined);
 assert.equal(r.response.headers["X-AIES-Answer-Source"],"deepseek");
 assert.equal(Sse.validateCandidateSse(r.response.body,"siri").ok,true);
 assert.ok(r.response.body.includes("【DeepSeek · AIES】"));
 assert.ok(r.response.body.includes("DEEPSEEK_ANSWER"));
 assert.ok(!r.response.body.includes("QWEN_ORIGINAL"));
 assert.ok(e.logs.includes("[AIES_V07] REQUEST_VALIDATED"));
 assert.ok(e.logs.includes("[AIES_V07] LOCAL_SSE_RESPONSE_READY"));
 assert.equal(e.requests.length,1);
 assert.equal(JSON.parse(e.requests[0].body).messages.length,2);
 assert.ok(e.logs.every(x=>!x.includes(key)&&!x.includes(prompt)));
});
test("second and third followups construct consistent synthetic native SSE and verified DeepSeek-only history",()=>{
 const e=createEnv(),first=e.invoke(e.request()),sid=extract(first.response.body,"session.created").id;
 const choice1=extract(first.response.body,"session.response.choices[].added").choice.id;
 const url=URL.replace("/sessions/responses","/sessions/"+sid+"/responses");
 const two=e.invoke(e.request(followupBody("siri.multimodal.noRTI","And the rings?",choice1),url));
 assert.equal(two.response.status,200);
 assert.ok(two.response.body.startsWith("event: session.response.created\n"));
 assert.ok(!two.response.body.includes("event: session.created\n"));
 const choice2=extract(two.response.body,"session.response.choices[].added").choice.id;
 const three=e.invoke(e.request(followupBody("siri.multimodal.noRTI","How many rings?",choice2),url));
 assert.equal(three.response.status,200);
 assert.equal(e.requests.length,3);
 const roles=JSON.parse(e.requests[2].body).messages.map(v=>v.role);
 assert.deepEqual(roles,["system","user","assistant","user","assistant","user"]);
 assert.ok(three.response.body.includes("【DeepSeek · AIES】"));
 assert.ok(e.logs.filter(x=>x.includes("LOCAL_SSE_RESPONSE_READY")).length===3);
});
test("new unknown Siri group can use strict text-only STRUCTURAL followup with exact verified history",()=>{
 const e=createEnv(),first=e.invoke(e.request()),sid=extract(first.response.body,"session.created").id;
 const url=URL.replace("/sessions/responses","/sessions/"+sid+"/responses");
 const follow=e.invoke(e.request(followupBody("siri.multimodal.specialText","More detail"),url));
 assert.equal(follow.response.status,200);
 assert.ok(e.logs.includes("[AIES_V07] FOLLOWUP_STRUCTURAL_GROUP_CANDIDATE"));
 assert.equal(e.requests.length,2);
 const wrong=e.invoke(e.request(followupBody("siri.multimodal.specialText","More detail"),
  URL.replace("/sessions/responses","/sessions/sess_OTHER/responses")));
 assert.equal(wrong.response.status,502);
 assert.equal(e.requests.length,2);
});
test("unknown Siri group on first request fails closed without DeepSeek billing",()=>{
 const e=createEnv();
 const r=e.invoke(e.request(initialBody("siri.multimodal.specialText")));
 assert.equal(r.response.status,502);
 assert.ok(e.logs.includes("[AIES_V07] MAIN_GROUP_BLOCKED"));
 assert.equal(e.requests.length,0);
});
test("unsupported tool/media groups and non-text items cannot reach DeepSeek",()=>{
 const e=createEnv(),first=e.invoke(e.request()),sid=extract(first.response.body,"session.created").id;
 const url=URL.replace("/sessions/responses","/sessions/"+sid+"/responses");
 for(const group of ["siri.tool.execute","siri.multimodal.audio","siri.camera","bad_group"]){
  const x=e.invoke(e.request(followupBody(group,"private"),url));
  assert.equal(x.response.status,502);
 }
 for(const node of [{type:"image",text:"private"},{type:"tool_call",text:"private"},
  {type:"audio",value:"private"}]){
  const obj=JSON.parse(followupBody("siri.multimodal.specialText","private"));
  obj.input[0].message.content=[node];
  const r=e.invoke(e.request(JSON.stringify(obj),url));
  assert.equal(r.response.status,502);
 }
 assert.equal(e.requests.length,1);
});
test("non-Siri clients and non-target paths are passed unchanged without a model request",()=>{
 const e=createEnv();
 const u=e.invoke(e.request(initialBody(),URL,"WritingTools (iPad)"));
 assert.equal(JSON.stringify(u),"{}");
 const v=e.invoke(e.request(initialBody(),"https://example.com/api"));
 assert.equal(JSON.stringify(v),"{}");
 assert.equal(e.requests.length,0);
});
test("no matching previous choice, missing session, or expired DeepSeek history never falls back to Qwen",()=>{
 const e=createEnv(),first=e.invoke(e.request()),sid=extract(first.response.body,"session.created").id;
 const url=URL.replace("/sessions/responses","/sessions/"+sid+"/responses");
 const unknown=e.invoke(e.request(followupBody("siri.multimodal.specialText","?", "choice_OTHER"),url));
 assert.equal(unknown.response.status,502);
 for(const k of Object.keys(e.data))if(k.startsWith("AIES_CTX_")){
  const raw=e.data[k];if(!raw)continue;
  try{const obj=JSON.parse(raw);if(obj.exp)obj.exp=Date.now()-1;e.data[k]=JSON.stringify(obj);}catch(e){}
 }
 const expired=e.invoke(e.request(followupBody("siri.multimodal.specialText","?"),url));
 assert.equal(expired.response.status,502);
 assert.equal(e.requests.length,1);
});
test("DeepSeek timeout, network failure, and invalid completion return 502 without leaking Qwen",()=>{
 const e=createEnv();
 const bad=[(opts,cb)=>cb(new Error("offline"),null,""),
  (opts,cb)=>cb(null,{statusCode:500},"bad"),
  (opts,cb)=>cb(null,{statusCode:200},JSON.stringify({choices:[{finish_reason:"length",message:{content:"bad"}}]}))];
 for(const fn of bad){
  const r=e.invoke(e.request(),{post:fn});
  assert.equal(r.response.status,502);
  assert.ok(!r.response.body.includes("DEEPSEEK_ANSWER"));
 }
});
test("simultaneous first requests keep independent DeepSeek callbacks and sessions without tags",()=>{
 const data={SAIRS_DEEPSEEK_API_KEY:key},pending=[],doneA=[],doneB=[],logs=[];
 function start(question,results){
  const ctx={$request:{url:URL,method:"POST",
     headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},
     body:initialBody("siri.multimodal.noRTI",question)},
   $persistentStore:{read:k=>data[k]||null,write:(v,k)=>{data[k]=v;return true;}},
   $httpClient:{post:(opts,cb)=>pending.push({opts,cb})},
   $done:x=>results.push(x),console:{log:x=>logs.push(x)},Date,Math,
   setTimeout:()=>1,clearTimeout:()=>{}};
  vm.runInNewContext(code,ctx,{timeout:1000});
 }
 start("FIRST_PRIVATE_TEST_A",doneA);
 start("SECOND_PRIVATE_TEST_B",doneB);
 assert.equal(pending.length,2);
 assert.equal(doneA.length,0);
 assert.equal(doneB.length,0);
 const respond=(entry,answer)=>entry.cb(null,{statusCode:200},
  JSON.stringify({choices:[{finish_reason:"stop",message:{content:answer}}]}));
 respond(pending[1],"DEEPSEEK_B");
 respond(pending[0],"DEEPSEEK_A");
 assert.equal(doneA.length,1);
 assert.equal(doneB.length,1);
 assert.equal(doneA[0].response.status,200);
 assert.equal(doneB[0].response.status,200);
 assert.ok(doneA[0].response.body.includes("DEEPSEEK_A"));
 assert.ok(!doneA[0].response.body.includes("DEEPSEEK_B"));
 assert.ok(doneB[0].response.body.includes("DEEPSEEK_B"));
 assert.ok(!doneB[0].response.body.includes("DEEPSEEK_A"));
 const sidA=extract(doneA[0].response.body,"session.created").id;
 const sidB=extract(doneB[0].response.body,"session.created").id;
 assert.notEqual(sidA,sidB);
 assert.ok(data["AIES_CTX_SESSION_"+sidA]);
 assert.ok(data["AIES_CTX_SESSION_"+sidB]);
 assert.equal(JSON.stringify(doneA[0]).includes("FIRST_PRIVATE_TEST_A"),false);
 assert.equal(logs.some(x=>x.includes("FIRST_PRIVATE_TEST_A")||x.includes("SECOND_PRIVATE_TEST_B")),false);
});
test("timeout finalizes one 502, late DeepSeek callback cannot overwrite or store a session",()=>{
 const data={SAIRS_DEEPSEEK_API_KEY:key},returns=[],timeouts=[];
 let later=null;
 const ctx={$request:{url:URL,method:"POST",
   headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},body:initialBody()},
  $persistentStore:{read:k=>data[k]||null,write:(v,k)=>{data[k]=v;return true;}},
  $httpClient:{post:(opts,cb)=>{later=cb;}},
  $done:x=>returns.push(x),console:{log:()=>{}},Date,Math,
  setTimeout:fn=>{timeouts.push(fn);return 1;},clearTimeout:()=>{}};
 vm.runInNewContext(code,ctx,{timeout:1000});
 assert.equal(timeouts.length,1);
 assert.equal(returns.length,0);
 timeouts[0]();
 assert.equal(returns.length,1);
 assert.equal(returns[0].response.status,502);
 later(null,{statusCode:200},JSON.stringify({
  choices:[{finish_reason:"stop",message:{content:"LATE_RESPONSE_PRIVATE"}}]}));
 assert.equal(returns.length,1);
 assert.ok(!Object.keys(data).some(k=>k.startsWith("AIES_CTX_")));
});
test("model request contains user text only, never Siri tools, response format, or input hints",()=>{
 const e=createEnv();
 const obj=JSON.parse(initialBody());
 obj.client_tools=[{function:{name:"TOOL_PRIVATE_NEVER_SEND"}}];
 obj.server_tools=[{type:"SERVER_PRIVATE_NEVER_SEND"}];
 obj.response_format={type:"RESPONSE_PRIVATE_NEVER_SEND"};
 obj.input_hint="INPUT_HINT_PRIVATE_NEVER_SEND";
 const r=e.invoke(e.request(JSON.stringify(obj)));
 assert.equal(r.response.status,200);
 const sent=JSON.stringify(JSON.parse(e.requests[0].body));
 for(const privateText of ["TOOL_PRIVATE_NEVER_SEND","SERVER_PRIVATE_NEVER_SEND",
  "RESPONSE_PRIVATE_NEVER_SEND","INPUT_HINT_PRIVATE_NEVER_SEND"]){
  assert.equal(sent.includes(privateText),false);
  assert.equal(r.response.body.includes(privateText),false);
 }
 assert.ok(!r.response.body.includes("AIES_INTERNAL_PLACEHOLDER"));
});
test("direct synthetic preflight rejects any forged response-hook invocation",()=>{
 const e=createEnv(),r=e.request();
 const out=[];
 vm.runInNewContext(code,{$request:r,$response:{status:200,body:"QWEN_PRIVATE"},
  $persistentStore:{read:k=>e.data[k]||null,write:(v,k)=>{e.data[k]=v;return true;}},
  $httpClient:{post:()=>{throw Error("never call model")}},$done:v=>out.push(v),
  console:{log:v=>e.logs.push(v)},Date,Math},{timeout:1000});
 assert.equal(JSON.stringify(out[0]),"{}");
 assert.equal(e.requests.length,0);
});
