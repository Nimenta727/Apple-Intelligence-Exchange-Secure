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
test("63 is opt-in local-only and deliberately uses two request hooks with zero response hooks",()=>{
 const hooks=mod.split("\n").filter(x=>x.startsWith("AIES63 "));
 assert.equal(hooks.length,2);
 assert.ok(hooks.every(x=>x.includes("type=http-request")));
 assert.ok(hooks.every(x=>x.endsWith(",script-path=Script/aies_siri_deepseek_v07_request_first.js,enable=true")));
 assert.equal(mod.includes("type=http-response"),false);
 assert.equal(mod.includes("script-path=https://"),false);
 assert.match(mod,/NEVER together/);
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
