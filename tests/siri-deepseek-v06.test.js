"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const Sse=require("./fixtures/siri-sse");
const script=fs.readFileSync(path.join(__dirname,"../scripts/aies_siri_deepseek_v06.js"),"utf8");
const moduleText=fs.readFileSync(path.join(__dirname,"../shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule"),"utf8");
const localProbe=fs.readFileSync(path.join(__dirname,"../scripts/siri_group_probe_ONCE.js"),"utf8");
const localStop=fs.readFileSync(path.join(__dirname,"../scripts/siri_group_probe_STOP_ONCE.js"),"utf8");
const schemaProbe=fs.readFileSync(path.join(__dirname,"../scripts/siri_schema_probe_ONCE.js"),"utf8");
const schemaStop=fs.readFileSync(path.join(__dirname,"../scripts/siri_schema_probe_STOP_ONCE.js"),"utf8");
const bodyProbe=fs.readFileSync(path.join(__dirname,"../scripts/siri_qwen_body_probe_ONCE.js"),"utf8");
const bodyStop=fs.readFileSync(path.join(__dirname,"../scripts/siri_qwen_body_probe_STOP_ONCE.js"),"utf8");
const abReader=fs.readFileSync(path.join(__dirname,"../scripts/ab_deepseek_trace_ONCE.js"),"utf8");
const abStop=fs.readFileSync(path.join(__dirname,"../scripts/ab_deepseek_trace_STOP_ONCE.js"),"utf8");
const URL="https://prod-yabuli.qianwen.com/v1/sessions/responses";
const fixture=Sse.candidateSse("QWEN_ORIGINAL_ANSWER_TEST","Sample","siri",{now:()=>1730000000000,id:()=>"beta-test"});
const promptBody=JSON.stringify({configuration:{response_configuration_group_id:"siri.tqa"},input:[{content:"Explain why the sky is blue"}]});
const KEY="sk_fake_test_12345678901234567890";
function env(options={}){
 const data={SAIRS_DEEPSEEK_API_KEY:KEY},logs=[],requests=[];
 const storage={read:key=>data[key]||null,write:(value,key)=>{data[key]=value;return true;}};
 const invoke=(request,response,client)=>{
  let returned=[],clock=[];
  const ctx={$request:request,$response:response,$persistentStore:storage,
   $httpClient:client||{post:(opts,callback)=>{requests.push(opts);callback(null,{statusCode:200},JSON.stringify({choices:[{finish_reason:"stop",message:{content:"DEEPSEEK_EXCLUSIVE_REPLY"}}]}));}},
   $done:x=>returned.push(x),console:{log:x=>logs.push(x)},
   setTimeout:fn=>{clock.push(fn);return clock.length;},clearTimeout:()=>{},
   Date,Math};
  if(response===undefined)delete ctx.$response;
  vm.runInNewContext(script,ctx,{timeout:1000});
  return {returned,clock};
 };
 const request={url:URL,method:"POST",headers:{"Content-Type":"application/json"},body:promptBody};
 return {data,logs,requests,invoke,request};
}
test("single install module exposes both HTTP hooks",()=>{
 assert.match(moduleText,/type=http-request/);
 assert.match(moduleText,/type=http-response/);
 assert.match(moduleText,/requires-body=true/);
 assert.match(moduleText,/type=http-response/);
 assert.ok(!/DOMAIN,prod-yabuli\.qianwen\.com,DIRECT/.test(moduleText));
});
test("complete dual-hook mock returns only DeepSeek answer and preserves source marker",()=>{
 const e=env(),a=e.invoke(e.request);
 assert.equal(a.returned.length,1);
 const injected=a.returned[0].headers;
 assert.ok(injected["X-AIES-Request-ID"].startsWith("aies_"));
 const respReq={...e.request,headers:injected};
 const b=e.invoke(respReq,{body:fixture,status:200,headers:{"Content-Type":"text/event-stream"}});
 assert.equal(b.returned.length,1);
 assert.equal(b.returned[0].status,200);
 assert.match(b.returned[0].body,/DEEPSEEK_EXCLUSIVE_REPLY/);
 assert.ok(!b.returned[0].body.includes("QWEN_ORIGINAL_ANSWER_TEST"));
 assert.equal(b.returned[0].headers["X-AIES-Answer-Source"],"deepseek");
 assert.equal(Sse.validateCandidateSse(b.returned[0].body,"siri").ok,true);
 assert.equal(e.requests.length,1);
 assert.equal(JSON.parse(e.requests[0].body).model,"deepseek-flash");
 assert.equal(e.requests[0].headers.Authorization,"Bearer "+KEY);
 assert.ok(e.logs.every(x=>!x.includes(KEY)&&!x.includes("Explain why")));
 assert.equal(e.data["AIES_R1_"+injected["X-AIES-Request-ID"]],"");
});
test("A-B DeepSeek trace is disabled by default and cannot change HTTP hook behavior",()=>{
 const e=env(),a=e.invoke(e.request);
 const r=e.invoke({...e.request,headers:a.returned[0].headers},{status:200,body:fixture});
 assert.equal(r.returned[0].status,200);
 assert.equal(e.data.AIES_AB_DEEPSEEK_V1_STATE,undefined);
 assert.ok(e.logs.every(x=>!x.includes("AIES_AB_DEEPSEEK_LOCAL")));
});
test("explicit A-B DeepSeek arm collects bounded model JSON metadata, response structure and sanitized test answer",()=>{
 const e=env();
 const time=Date.now();
 e.data.AIES_AB_DEEPSEEK_V1_STATE=JSON.stringify({
  v:1,phase:"armed",createdAt:time,expiresAt:time+600000,events:[]
 });
 const a=e.invoke({...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"}});
 const b=e.invoke({...e.request,headers:{...a.returned[0].headers,"User-Agent":"Siri (iPad - Version 27.3.0)"}},
  {status:200,body:fixture,headers:{"Content-Type":"text/event-stream"}},
  {post:(_opts,callback)=>callback(null,{statusCode:200},JSON.stringify({
   id:"PRIVATE_RESPONSE_ID",
   choices:[{finish_reason:"stop",message:{role:"assistant",content:"Model says contact test@example.com then sk-SENSITIVE01234567890000"}}],
   usage:{prompt_tokens:120,completion_tokens:44,total_tokens:164}
  }))});
 assert.equal(b.returned[0].status,200);
 const st=JSON.parse(e.data.AIES_AB_DEEPSEEK_V1_STATE);
 assert.ok(st.events.some(x=>x.stage==="SIRI_REQUEST"&&x.promptChars>0));
 assert.ok(st.events.some(x=>x.stage==="SSE_STRUCTURE"&&x.route==="MAIN_UPSTREAM"&&x.eventCount===12));
 const model=st.events.find(x=>x.stage==="DEEPSEEK_API");
 assert.equal(model.status,200);
 assert.equal(model.finishReason,"stop");
 assert.equal(model.outputChars>0,true);
 assert.equal(model.usage.total_tokens,164);
 assert.equal(model.reasoningType,"missing_or_other");
 assert.ok(model.answerText.includes("[REDACTED_EMAIL]"));
 assert.ok(model.answerText.includes("[REDACTED_KEY]"));
 assert.ok(!JSON.stringify(st).includes("PRIVATE_RESPONSE_ID"));
 assert.ok(!JSON.stringify(st).includes("QWEN_ORIGINAL_ANSWER_TEST"));
 assert.ok(!JSON.stringify(st).includes("test@example.com"));
 assert.ok(!JSON.stringify(st).includes("sk-SENSITIVE01234567890000"));
 assert.ok(st.events.some(x=>x.stage==="AIES_OUTPUT"&&x.markerPresent===true));
 const logs=[],returns=[];
 vm.runInNewContext(abReader,{$persistentStore:{
  read:k=>e.data[k]||null,write:(v,k)=>{e.data[k]=v;return true;}
 },$done:x=>returns.push(x),console:{log:x=>logs.push(x)},Date,Math},{timeout:1000});
 assert.ok(logs.some(x=>x.endsWith("CAPTURED_LOCAL_READOUT")));
 assert.ok(logs.some(x=>x.endsWith("CAPTURE_CLEARED")));
 assert.ok(logs.some(x=>x.includes("TRACE_PART_001=")));
 assert.equal(e.data.AIES_AB_DEEPSEEK_V1_STATE,"");
 assert.equal(returns.length,1);
});
test("AB trace identifies failed session follow-up SSE without collecting Qwen text or blocking unrelated URLs",()=>{
 const e=env(),now=Date.now();
 e.data.AIES_AB_DEEPSEEK_V1_STATE=JSON.stringify({
  v:1,phase:"armed",createdAt:now,expiresAt:now+600000,events:[]
 });
 const req={url:"https://prod-yabuli.qianwen.com/v1/sessions/abcd1234/responses",
  method:"POST",headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"}};
 const r=e.invoke(req,{status:200,headers:{"Content-Type":"text/event-stream"},body:fixture});
 assert.equal(r.returned[0].status,502);
 const events=JSON.parse(e.data.AIES_AB_DEEPSEEK_V1_STATE).events;
 assert.ok(events.some(x=>x.stage==="SSE_STRUCTURE"&&x.route==="SESSION_FOLLOWUP_BLOCKED"));
 assert.ok(events.some(x=>x.code==="QWEN_SESSION_FOLLOWUP_SSE_BLOCKED"));
 assert.ok(!JSON.stringify(events).includes("QWEN_ORIGINAL_ANSWER_TEST"));
 assert.ok(!JSON.stringify(events).includes("abcd1234"));
 const non=env(),r2=non.invoke({...req,url:"https://other.example.com/v1/sessions/responses"},
  {status:200,headers:{"Content-Type":"text/event-stream"},body:fixture});
 assert.equal(JSON.stringify(r2.returned[0]),"{}");
});


function eventPayload(raw,name){
 const frame=raw.split("\n\n").find(x=>x.startsWith("event: "+name+"\n"));
 assert.ok(frame,"event "+name+" exists");
 return JSON.parse(frame.split("\n").find(x=>x.startsWith("data: ")).slice(6))[name];
}
function siriFollowupFixture(sessionId,salt="followup"){
 const native=Sse.candidateSse("QWEN_FOLLOWUP_ONLY", "PRIVATE_NATIVE_CONTEXT","siri",
  {now:()=>1730000005000,id:()=>salt});
 const nativeSid=eventPayload(native,"session.created").id;
 return native.slice(native.indexOf("event: session.response.created"))
  .split(nativeSid).join(sessionId);
}
function siriFollowupRequest(e,sessionId,previousChoice,prompt="Which planet is largest?"){
 return {...e.request,url:URL.replace("/sessions/responses","/sessions/"+sessionId+"/responses"),
  headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},
  body:JSON.stringify({
   configuration:{response_configuration_group_id:"siri.multimodal.noRTI"},
   input:[{type:"message",message:{role:"user",content:[{type:"text",text:prompt}]}}],
   previous_choice_id:previousChoice,stream:true
  })};
}
function completeFirstSiriTurn(e){
 const req={...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"}};
 const a=e.invoke(req);
 const response=e.invoke({...req,headers:{...req.headers,...a.returned[0].headers}},
  {status:200,body:fixture,headers:{"Content-Type":"text/event-stream"}});
 assert.equal(response.returned[0].status,200);
 const raw=response.returned[0].body;
 const sid=eventPayload(raw,"session.created").id;
 const prev=eventPayload(raw,"session.response.choices[].added").choice.id;
 return {sid,prev,raw};
}
test("Siri followup uses prior verified DeepSeek-only context and emits observed response.created-first SSE",()=>{
 const e=env(),first=completeFirstSiriTurn(e);
 assert.ok(e.data["AIES_CTX_"+first.prev],"first verified reply stored");
 const req=siriFollowupRequest(e,first.sid,first.prev);
 const a=e.invoke(req);
 assert.ok(a.returned[0].headers["X-AIES-Request-ID"]);
 const b=e.invoke({...req,headers:{...req.headers,...a.returned[0].headers}},
  {status:200,headers:{"Content-Type":"text/event-stream"},body:siriFollowupFixture(first.sid)});
 assert.equal(b.returned[0].status,200);
 assert.ok(b.returned[0].body.startsWith("event: session.response.created\n"));
 assert.ok(!b.returned[0].body.includes("event: session.created\n"));
 assert.ok(b.returned[0].body.includes("【DeepSeek · AIES】"));
 assert.ok(!b.returned[0].body.includes("QWEN_FOLLOWUP_ONLY"));
 assert.equal(e.requests.length,2);
 const messages=JSON.parse(e.requests[1].body).messages;
 assert.deepEqual(messages.map(x=>x.role),["system","user","assistant","user"]);
 assert.equal(messages[1].content,"Explain why the sky is blue");
 assert.equal(messages[2].content,"DEEPSEEK_EXCLUSIVE_REPLY");
 assert.equal(messages[3].content,"Which planet is largest?");
 assert.ok(e.logs.includes("[AIES_V06] SIRI_CONTEXT_STORED"));
 assert.ok(!e.logs.some(x=>x.includes("Which planet")||x.includes("Explain why")));
});
test("Siri second and third turns retain session/choice linkage and verified history",()=>{
 const e=env(),first=completeFirstSiriTurn(e);
 const req=siriFollowupRequest(e,first.sid,first.prev,"What is its color?");
 const tag=e.invoke(req).returned[0].headers;
 const second=e.invoke({...req,headers:{...req.headers,...tag}},
  {status:200,body:siriFollowupFixture(first.sid,"turn-two")});
 assert.equal(second.returned[0].status,200);
 const choice=eventPayload(second.returned[0].body,"session.response.choices[].added").choice.id;
 const thirdReq=siriFollowupRequest(e,first.sid,choice,"Why does it look that way?");
 const thirdTag=e.invoke(thirdReq).returned[0].headers;
 assert.ok(thirdTag["X-AIES-Request-ID"]);
 const third=e.invoke({...thirdReq,headers:{...thirdReq.headers,...thirdTag},body:undefined},
  {status:200,body:siriFollowupFixture(first.sid,"turn-three")});
 assert.equal(third.returned[0].status,200);
 assert.equal(e.requests.length,3);
 assert.deepEqual(JSON.parse(e.requests[2].body).messages.map(x=>x.role),
  ["system","user","assistant","user","assistant","user"]);
});
test("Siri followup without verified previous DeepSeek choice is rejected before model billing",()=>{
 const e=env();
 const req=siriFollowupRequest(e,"sess_unknown","choice_unknown");
 const r=e.invoke(req);
 assert.equal(r.returned[0].response.status,502);
 assert.ok(e.logs.includes("[AIES_V06] ERROR_FOLLOWUP_CONTEXT_UNAVAILABLE"));
 assert.equal(e.requests.length,0);
});
test("Siri followup session mismatches, malformed previous IDs and expired context fail closed",()=>{
 const e=env(),first=completeFirstSiriTurn(e);
 const other=siriFollowupRequest(e,"sess_other",first.prev);
 const a=e.invoke(other);
 assert.equal(a.returned[0].response.status,502);
 const malformed=siriFollowupRequest(e,first.sid,"wrong/value");
 const b=e.invoke(malformed);
 assert.equal(b.returned[0].response.status,502);
 e.data["AIES_CTX_"+first.prev]=JSON.stringify({...JSON.parse(e.data["AIES_CTX_"+first.prev]),exp:Date.now()-1});
 const old=e.invoke(siriFollowupRequest(e,first.sid,first.prev));
 assert.equal(old.returned[0].response.status,502);
 assert.equal(e.requests.length,1);
});
test("Siri followup response tag and matching stream session are mandatory",()=>{
 const e=env(),first=completeFirstSiriTurn(e),req=siriFollowupRequest(e,first.sid,first.prev);
 const noTag=e.invoke(req,{status:200,headers:{"Content-Type":"text/event-stream"},body:siriFollowupFixture(first.sid)});
 assert.equal(noTag.returned[0].status,502);
 assert.ok(e.logs.includes("[AIES_V06] QWEN_SESSION_FOLLOWUP_SSE_BLOCKED"));
 const a=e.invoke(req),tag=a.returned[0].headers;
 const mismatched=e.invoke({...req,headers:{...req.headers,...tag}},
  {status:200,body:siriFollowupFixture("sess_wrong")});
 assert.equal(mismatched.returned[0].status,502);
 assert.ok(e.logs.includes("[AIES_V06] ERROR_SSE_REWRITE_UNSUPPORTED"));
 assert.equal(e.requests.length,1);
});
test("WritingTools and unknown client followup routes remain pass-through and do not use Siri context",()=>{
 const e=env(),req={url:URL.replace("/sessions/responses","/sessions/sess_safe/responses"),
  method:"POST",body:"PRIVATE",headers:{"User-Agent":"WritingTools (iPad - Version 27.3.0)"}};
 assert.equal(JSON.stringify(e.invoke(req).returned[0]),"{}");
 assert.equal(JSON.stringify(e.invoke(req,{status:200,body:siriFollowupFixture("sess_safe"),
  headers:{"Content-Type":"text/event-stream"}}).returned[0]),"{}");
 assert.equal(e.requests.length,0);
});
function annotatedQwenSse(raw,annotationCount=5,position="after_text_done"){
 const eventName="session.response.choices[].items[].message.content[].text.annotations[].added";
 let out=raw;
 for(let i=0;i<annotationCount;i++){
  const a={type:eventName};
  a[eventName]={choice_index:0,item_index:0,content_index:0,index:i,
   annotation:{type:"url_citation",url:"https://PRIVATE_QWEN_SOURCE_INVALID.example/citation",
    title:"QWEN_ANNOTATION_PRIVATE_ANSWER"}};
  const evt="event: "+eventName+"\ndata: "+JSON.stringify(a)+"\n\n";
  const before=position==="before_text_done"?
   "event: session.response.choices[].items[].message.content[].text.value.done\n":
   position==="after_content_done"?
   "event: session.response.choices[].items[].done\n":
   "event: session.response.choices[].items[].message.content[].done\n";
  assert.ok(out.includes(before));
  out=out.replace(before,evt+before);
 }
 return out;
}
test("Siri 24/26-event annotated Qwen SSE allows DeepSeek rewriting without leaking citation text or links",()=>{
 for(const n of [5,6]){
  let raw=annotatedQwenSse(fixture,n);
  raw=changeNativeEvent(raw,"session.response.choices[].items[].done",v=>{
   v.item.message.content[0].text.annotations=[{title:"QWEN_ANNOTATION_PRIVATE_ANSWER"}];
  });
  raw=changeNativeEvent(raw,"session.response.choices[].completed",v=>{
   v.choice.output[0].message.content[0].text.annotations=[{url:"https://PRIVATE_QWEN_SOURCE_INVALID.example/citation"}];
  });
  raw=changeNativeEvent(raw,"session.response.choices[].done",v=>{
   v.choice.output[0].message.content[0].text.annotations=[{title:"QWEN_ANNOTATION_PRIVATE_ANSWER"}];
  });
  raw=changeNativeEvent(raw,"session.response.done",v=>{
   v.choices[0].output[0].message.content[0].text.annotations=[{title:"QWEN_ANNOTATION_PRIVATE_ANSWER"}];
  });
  const e=env(),a=e.invoke(e.request);
  const b=e.invoke({...e.request,headers:a.returned[0].headers},
   {status:200,headers:{"Content-Type":"text/event-stream"},body:raw});
  assert.equal(b.returned[0].status,200);
  assert.equal(e.requests.length,1);
  assert.ok(b.returned[0].body.includes("DEEPSEEK_EXCLUSIVE_REPLY"));
  assert.equal(Sse.validateCandidateSse(b.returned[0].body,"siri").ok,true);
  assert.ok(!b.returned[0].body.includes("QWEN_ANNOTATION_PRIVATE_ANSWER"));
  assert.ok(!b.returned[0].body.includes("PRIVATE_QWEN_SOURCE_INVALID"));
  assert.ok(!b.returned[0].body.includes("QWEN_ORIGINAL_ANSWER_TEST"));
  assert.ok(!b.returned[0].body.includes("text.annotations[].added"));
 }
});
test("Qwen citation frames in unobserved positions still fail closed before DeepSeek billing",()=>{
 for(const position of ["before_text_done","after_content_done"]){
  const raw=annotatedQwenSse(fixture,2,position);
  const e=env(),a=e.invoke(e.request);
  const b=e.invoke({...e.request,headers:a.returned[0].headers},
   {status:200,body:raw});
  assert.equal(b.returned[0].status,502);
  assert.equal(e.requests.length,0);
  assert.ok(e.logs.includes("[AIES_V06] ERROR_SSE_REWRITE_UNSUPPORTED"));
  assert.ok(!JSON.stringify(b.returned[0]).includes("QWEN_ANNOTATION_PRIVATE_ANSWER"));
 }
});

test("verified DeepSeek answer is visibly labeled once in the rewritten Siri SSE and provider identity prompt",()=>{
 const e=env();
 const req=e.invoke(e.request);
 const response=e.invoke({...e.request,headers:req.returned[0].headers},{body:fixture,status:200});
 assert.equal(response.returned[0].status,200);
 const body=response.returned[0].body;
 assert.ok(body.includes("【DeepSeek · AIES】"));
 const name="session.response.choices[].items[].message.content[].text.value.delta";
 const frames=body.trim().split("\n\n");
 const contentFrame=frames.find(frame=>frame.startsWith("event: "+name+"\n"));
 assert.ok(contentFrame);
 const answerJSON=JSON.parse(contentFrame.split("\n")[1].slice(6));
 const visibleContent=JSON.parse(answerJSON[name].delta).content;
 assert.ok(visibleContent.startsWith("【DeepSeek · AIES】\n"));
 assert.equal(visibleContent.split("【DeepSeek · AIES】").length-1,1);
 assert.ok(body.includes("DEEPSEEK_EXCLUSIVE_REPLY"));
 assert.ok(!body.includes("QWEN_ORIGINAL_ANSWER_TEST"));
 assert.equal(response.returned[0].headers["X-AIES-Answer-Source"],"deepseek");
 assert.ok(e.logs.includes("[AIES_V06] SSE_PREFLIGHT_PASSED"));
 assert.ok(e.logs.includes("[AIES_V06] DEEPSEEK_LABEL_APPLIED"));
 assert.ok(e.logs.includes("[AIES_V06] DEEPSEEK_RESPONSE_ATTEMPTED"));
 assert.ok(e.logs.includes("[AIES_V06] RESPONSE_TAG_PRESENT"));
 assert.ok(e.logs.includes("[AIES_V06] RESPONSE_PROMPT_FROM_STORE"));
 const modelPayload=JSON.parse(e.requests[0].body);
 assert.ok(modelPayload.messages[0].content.includes("DeepSeek"));
 assert.ok(modelPayload.messages[0].content.includes("AIES"));
 assert.ok(!modelPayload.messages[0].content.includes("千问或 Qwen 生成的回答"));
 assert.equal(Sse.validateCandidateSse(body,"siri").ok,true);
});
test("provider marker never appears on errors or unvalidated upstream responses",()=>{
 const badProvider=env(),a=badProvider.invoke(badProvider.request);
 const bad=badProvider.invoke({...badProvider.request,headers:a.returned[0].headers},{body:fixture,status:200},{
  post:(options,callback)=>callback(null,{statusCode:503},"DOWN")
 });
 assert.equal(bad.returned[0].status,502);
 assert.ok(!JSON.stringify(bad.returned[0]).includes("【DeepSeek · AIES】"));
 assert.ok(!badProvider.logs.includes("[AIES_V06] DEEPSEEK_LABEL_APPLIED"));
 const invalidSse=env(),q=invalidSse.invoke(invalidSse.request);
 const b=invalidSse.invoke({...invalidSse.request,headers:q.returned[0].headers},
  {body:fixture.replace("session.created","wrong.event"),status:200});
 assert.equal(b.returned[0].status,502);
 assert.equal(invalidSse.requests.length,0);
 assert.ok(!JSON.stringify(b.returned[0]).includes("【DeepSeek · AIES】"));
 assert.ok(!invalidSse.logs.includes("[AIES_V06] DEEPSEEK_LABEL_APPLIED"));
});
test("response correlation diagnostics distinguish missing tag, store miss and request-body fallback without leaking content",()=>{
 const e=env();
 const untagged=e.invoke({...e.request,headers:{},body:undefined},{body:fixture,status:200});
 assert.equal(untagged.returned[0].status,502);
 assert.ok(e.logs.includes("[AIES_V06] RESPONSE_TAG_MISSING"));
 assert.ok(e.logs.includes("[AIES_V06] RESPONSE_PROMPT_BODY_UNAVAILABLE"));
 assert.ok(e.logs.includes("[AIES_V06] ERROR_PROMPT_UNAVAILABLE"));
 assert.equal(e.requests.length,0);
 const fallback=env();
 const r=fallback.invoke({...fallback.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"}},{body:fixture,status:200});
 assert.equal(r.returned[0].status,200);
 assert.ok(fallback.logs.includes("[AIES_V06] RESPONSE_TAG_MISSING"));
 assert.ok(fallback.logs.includes("[AIES_V06] RESPONSE_PROMPT_FROM_BODY"));
 assert.ok(r.returned[0].body.includes("【DeepSeek · AIES】"));
 const invalid=env();
 const bad=invalid.invoke({...invalid.request,headers:{"X-AIES-Request-ID":"SENSITIVE_BEARER_VALUE"},body:undefined},{body:fixture,status:200});
 assert.equal(bad.returned[0].status,502);
 assert.ok(invalid.logs.includes("[AIES_V06] RESPONSE_TAG_INVALID"));
 assert.ok(invalid.logs.every(x=>!x.includes("SENSITIVE_BEARER_VALUE")));
 const lost=env(),q=lost.invoke(lost.request);
 lost.data["AIES_R1_"+q.returned[0].headers["X-AIES-Request-ID"]]="";
 const missing=lost.invoke({...lost.request,headers:q.returned[0].headers,body:undefined},{body:fixture,status:200});
 assert.equal(missing.returned[0].status,502);
 assert.ok(lost.logs.includes("[AIES_V06] RESPONSE_PROMPT_STORE_MISSING"));
 assert.ok(lost.logs.includes("[AIES_V06] RESPONSE_PROMPT_BODY_UNAVAILABLE"));
});
test("concurrent prompts use independently keyed sessions",()=>{
 const e=env();
 const a=e.invoke(e.request),b=e.invoke({...e.request,body:promptBody.replace("sky","ocean")});
 assert.notEqual(a.returned[0].headers["X-AIES-Request-ID"],b.returned[0].headers["X-AIES-Request-ID"]);
 e.invoke({...e.request,headers:b.returned[0].headers,body:undefined},{body:fixture,status:200});
 e.invoke({...e.request,headers:a.returned[0].headers,body:undefined},{body:fixture,status:200});
 assert.equal(e.requests.length,2);
 assert.match(e.requests[0].body,/ocean/);
 assert.match(e.requests[1].body,/sky/);
});
test("DeepSeek failure replaces upstream SSE with error, never Qwen",()=>{
 const e=env(),x=e.invoke(e.request);
 const r=e.invoke({...e.request,headers:x.returned[0].headers},{body:fixture,status:200},{
  post:(opts,callback)=>callback(null,{statusCode:500},"error")
 });
 assert.equal(r.returned.length,1);
 assert.equal(r.returned[0].status,502);
 assert.ok(!JSON.stringify(r.returned[0]).includes("QWEN_ORIGINAL_ANSWER_TEST"));
 assert.match(r.returned[0].body,/MODEL_RESPONSE_INVALID/);
});
test("unrecognized SSE event is rejected after DeepSeek rather than passed through",()=>{
 const e=env(),x=e.invoke(e.request);
 const unusual=fixture.replace("event: session.created","event: unknown.event");
 const r=e.invoke({...e.request,headers:x.returned[0].headers},{body:unusual,status:200});
 assert.equal(r.returned[0].status,502);
 assert.match(r.returned[0].body,/SSE_REWRITE_UNSUPPORTED/);
});
test("missing key, missing request correlation and unsupported body fail closed",()=>{
 const e=env(),x=e.invoke(e.request);
 e.data.SAIRS_DEEPSEEK_API_KEY="";
 const bad=e.invoke({...e.request,headers:x.returned[0].headers},{body:fixture,status:200});
 assert.match(bad.returned[0].body,/KEY_NOT_PROVISIONED/);
 const orphan=e.invoke({url:URL,method:"POST",headers:{}},{body:fixture,status:200});
 assert.match(orphan.returned[0].body,/PROMPT_UNAVAILABLE/);
 const invalid=e.invoke({...e.request,body:"not json"});
 assert.equal(invalid.returned[0].response.status,502);
 assert.match(invalid.returned[0].response.body,/UNSUPPORTED_SIRI_REQUEST/);
});

test("safe parser reason codes identify failures without logging request secrets",()=>{
 const cases=[
  {body:undefined,stage:"BODY_NOT_TEXT"},
  {body:"",stage:"BODY_EMPTY"},
  {body:"PRIVATE_NOT_JSON",stage:"JSON_INVALID"},
  {body:"[]",stage:"ROOT_UNSUPPORTED"},
  {body:JSON.stringify({input:[{content:"Hello"}]}),stage:"GROUP_MISSING"},
  {body:JSON.stringify({configuration:{response_configuration_group_id:"other"},input:[{content:"Hello"}]}),stage:"GROUP_UNSUPPORTED"},
  {body:JSON.stringify({configuration:{response_configuration_group_id:"siri.tqa"},input:{content:"Hello"}}),stage:"INPUT_UNSUPPORTED"},
  {body:JSON.stringify({configuration:{response_configuration_group_id:"siri.tqa"},input:[{content:[{type:"image",data:"PRIVATE_ATTACHMENT"}]}]}),stage:"CONTENT_UNSUPPORTED"},
  {body:JSON.stringify({configuration:{response_configuration_group_id:"siri.tqa"},input:[{content:"data:image/png;base64,PRIVATE"}]}),stage:"MEDIA_UNSUPPORTED"},
  {body:JSON.stringify({configuration:{response_configuration_group_id:"siri.tqa"},input:[{content:"   "}]}),stage:"PROMPT_EMPTY"}
 ];
 for(const item of cases){
  const e=env(),r=e.invoke({...e.request,body:item.body,headers:{Authorization:"Bearer PRIVATE_AUTHORIZATION_TOKEN"}});
  assert.equal(r.returned[0].response.status,502,item.stage);
  assert.ok(e.logs.includes("[AIES_V06] REQUEST_DIAG_"+item.stage),item.stage);
  assert.ok(e.logs.includes("[AIES_V06] ERROR_UNSUPPORTED_SIRI_REQUEST"));
  assert.equal(e.requests.length,0);
  assert.ok(e.logs.every(x=>!x.includes("PRIVATE")&&!x.includes("Bearer")&&!x.includes("Hello")));
 }
});
test("strict single-object text wrappers and nested text.value are supported",()=>{
 const accepted=[
  {type:"text",text:"TEXT_OBJECT"},
  {type:"input_text",text:{value:"NESTED_TEXT"}},
  {type:"text",value:"VALUE_TEXT"}
 ];
 for(const content of accepted){
  const e=env();
  const body=JSON.stringify({configuration:{response_configuration_group_id:"siri.tqa"},input:[{message:{content}}]});
  const r=e.invoke({...e.request,body});
  assert.ok(r.returned[0].headers["X-AIES-Request-ID"]);
  assert.ok(e.logs.includes("[AIES_V06] REQUEST_CAPTURED"));
  assert.equal(e.logs.some(x=>x.includes("REQUEST_DIAG_")),false);
 }
 const e=env();
 const r=e.invoke({...e.request,body:JSON.stringify({configuration:{response_configuration_group_id:"siri.tqa"},input:[{content:{type:"text",text:{value:"x",private:"secret"}}}]})});
 assert.equal(r.returned[0].response.status,502);
 assert.ok(e.logs.includes("[AIES_V06] REQUEST_DIAG_CONTENT_UNSUPPORTED"));
});
test("oversized body rejection is bounded and does not echo input",()=>{
 const e=env(),r=e.invoke({...e.request,body:"S".repeat(300001)});
 assert.equal(r.returned[0].response.status,502);
 assert.ok(e.logs.includes("[AIES_V06] REQUEST_DIAG_BODY_OVERSIZE"));
 assert.ok(e.logs.every(x=>x.length<100));
});


function runLocal(e,source=localProbe,storeOverride=null){
 const output=[],logs=[];
 const store=storeOverride||{
  read:k=>e.data[k]||null,
  write:(v,k)=>{e.data[k]=v;return true;}
 };
 vm.runInNewContext(source,{$persistentStore:store,Date,
  console:{log:v=>logs.push(v)},$done:()=>output.push(true)},{timeout:1000});
 return {logs,output};
}
function probeState(e){return JSON.parse(e.data.AIES_SIRI_GROUP_PROBE_V2_STATE);}
function sirireq(e,group,ua="Siri (iPad - Version 27.3.0)",content="SAFE_QUESTION"){
 const body=JSON.stringify({configuration:{response_configuration_group_id:group},input:[{content}]});
 return e.invoke({...e.request,headers:{"User-Agent":ua,Authorization:"Bearer PRIVATE_SECRET"},body});
}
test("noRTI input failures report bounded fixed shape categories without exposing field names or values",()=>{
 const g="siri.multimodal.noRTI";
 const base={configuration:{response_configuration_group_id:g},input:[{content:"SAFE_TEXT"}]};
 const cases=[
  {value:{...base,privateSecret:"TOP_PRIVATE"},codes:["ROOT_FIELDS"]},
  {value:{configuration:base.configuration},codes:["ROOT_FIELDS","INPUT_MISSING"]},
  {value:{configuration:base.configuration,input:{content:"PRIVATE"}},codes:["INPUT_NOT_ARRAY"]},
  {value:{configuration:base.configuration,input:[]},codes:["INPUT_COUNT"]},
  {value:{configuration:base.configuration,input:["PRIVATE_STRING"]},codes:["ITEM_NOT_OBJECT"]},
  {value:{configuration:base.configuration,input:[{message:{content:"SAFE"},secret:"PRIVATE"}]},codes:["ITEM_WRAPPER_FIELDS"]},
  {value:{configuration:base.configuration,input:[{message:"PRIVATE"}]},codes:["MESSAGE_NOT_OBJECT"]},
  {value:{configuration:base.configuration,input:[{content:"SAFE",secret:"PRIVATE"}]},codes:["ITEM_FIELDS"]},
  {value:{configuration:base.configuration,input:[{role:"user"}]},codes:["CONTENT_MISSING"]},
  {value:{configuration:base.configuration,input:[{role:"assistant",content:"SAFE"}]},codes:["ROLE_UNSUPPORTED"]},
  {value:{configuration:base.configuration,input:[{type:"audio",content:"SAFE"}]},codes:["ITEM_TYPE_UNSUPPORTED"]},
  {value:{...base,privateSecret:"PRIVATE",input:{content:"SAFE"}},codes:["ROOT_FIELDS","INPUT_NOT_ARRAY"]}
 ];
 for(const c of cases){
  const e=env();
  const request={...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)",Authorization:"Bearer PRIVATE_ACCESS"},body:JSON.stringify(c.value)};
  const out=e.invoke(request);
  assert.equal(out.returned[0].response.status,502);
  assert.ok(e.logs.includes("[AIES_V06] REQUEST_DIAG_INPUT_UNSUPPORTED"));
  for(const code of c.codes)assert.ok(e.logs.includes("[AIES_V06] NORTI_SHAPE_"+code),code);
  assert.equal(e.requests.length,0);
  assert.ok(e.logs.every(x=>x.length<100&&!x.includes("PRIVATE")&&!x.includes("secret")&&!x.includes("SAFE_TEXT")));
 }
});
test("valid noRTI text envelopes do not emit structure diagnostic lines",()=>{
 const e=env();
 const body=JSON.stringify({configuration:{response_configuration_group_id:"siri.multimodal.noRTI"},input:[{message:{content:{type:"text",text:"SAFE"}}}]});
 const response=e.invoke({...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},body});
 assert.ok(response.returned[0].headers["X-AIES-Request-ID"]);
 assert.ok(!e.logs.some(x=>x.includes("NORTI_SHAPE_")));
});

test("observed iPadOS noRTI Siri group supports strict text through both hooks in offline mock",()=>{
 const e=env();
 const body=JSON.stringify({
  configuration:{response_configuration_group_id:"siri.multimodal.noRTI"},
  input:[{type:"message",role:"user",content:[{type:"text",text:{value:"Why is the sky blue?"}}]}]
 });
 const request={...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},body};
 const a=e.invoke(request);
 assert.equal(a.returned.length,1);
 assert.ok(a.returned[0].headers["X-AIES-Request-ID"]);
 assert.ok(e.logs.includes("[AIES_V06] REQUEST_CAPTURED"));
 assert.equal(e.requests.length,0);
 const b=e.invoke({...request,headers:{...request.headers,...a.returned[0].headers}},
  {status:200,body:fixture});
 assert.equal(b.returned.length,1);
 assert.equal(b.returned[0].status,200);
 assert.equal(b.returned[0].headers["X-AIES-Answer-Source"],"deepseek");
 assert.ok(b.returned[0].body.includes("DEEPSEEK_EXCLUSIVE_REPLY"));
 assert.ok(!b.returned[0].body.includes("QWEN_ORIGINAL_ANSWER_TEST"));
 assert.equal(e.requests.length,1);
 assert.deepEqual(JSON.parse(e.requests[0].body).messages[1].content,"Why is the sky blue?");
 assert.ok(e.logs.every(x=>!x.includes("Why is the sky blue?")));
});
test("confirmed real noRTI root fields and message wrapper allow text-only capture with no metadata forwarded",()=>{
 const e=env();
 const body=JSON.stringify({
  configuration:{response_configuration_group_id:"siri.multimodal.noRTI"},
  client_tools:[{name:"UNTRUSTED_TOOL_SPEC",description:"NEVER_SEND_TO_MODEL"}],
  server_tools:[{name:"UNTRUSTED_SERVER_TOOL"}],
  response_format:{kind:"SIRI_PRIVATE_METADATA"},
  input_hint:"PRIVATE_DEVICE_HINT_DO_NOT_FORWARD",
  stream:true,
  input:[{type:"message",message:{role:"user",content:[
   {type:"text",text:{value:"Why does sunlight warm Earth?"}}
  ]}}]
 });
 const request={...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},body};
 const first=e.invoke(request);
 assert.ok(first.returned[0].headers["X-AIES-Request-ID"]);
 assert.ok(e.logs.includes("[AIES_V06] REQUEST_CAPTURED"));
 assert.equal(e.requests.length,0);
 const second=e.invoke({...request,headers:{...request.headers,...first.returned[0].headers}},
  {status:200,body:fixture});
 assert.equal(second.returned[0].status,200);
 assert.equal(e.requests.length,1);
 assert.equal(JSON.parse(e.requests[0].body).messages[1].content,"Why does sunlight warm Earth?");
 const api=e.requests[0].body;
 assert.ok(!api.includes("UNTRUSTED_TOOL_SPEC"));
 assert.ok(!api.includes("UNTRUSTED_SERVER_TOOL"));
 assert.ok(!api.includes("SIRI_PRIVATE_METADATA"));
 assert.ok(!api.includes("PRIVATE_DEVICE_HINT_DO_NOT_FORWARD"));
 assert.ok(!JSON.stringify(second.returned[0]).includes("PRIVATE_DEVICE_HINT_DO_NOT_FORWARD"));
 assert.ok(!e.logs.some(x=>x.includes("Why does sunlight")||x.includes("NEVER_SEND")));
});
test("confirmed noRTI root field names require exact type, unknown root fields remain denied",()=>{
 const group="siri.multimodal.noRTI";
 const base={configuration:{response_configuration_group_id:group},input:[{type:"message",message:{role:"user",content:"SAFE"}}]};
 const bads=[
  {obj:{...base,client_tools:{type:"tool"}},stage:"NORTI_SHAPE_ROOT_FIELD_TYPES"},
  {obj:{...base,server_tools:"TOOL_LIST"},stage:"NORTI_SHAPE_ROOT_FIELD_TYPES"},
  {obj:{...base,response_format:[]},stage:"NORTI_SHAPE_ROOT_FIELD_TYPES"},
  {obj:{...base,stream:"true"},stage:"NORTI_SHAPE_ROOT_FIELD_TYPES"},
  {obj:{...base,input_hint:123},stage:"NORTI_SHAPE_ROOT_FIELD_TYPES"},
  {obj:{...base,input_hint:null},stage:"NORTI_SHAPE_ROOT_FIELD_TYPES"},
  {obj:{...base,input_hint:{value:"PRIVATE_HINT"}},stage:"NORTI_SHAPE_ROOT_FIELD_TYPES"},
  {obj:{...base,attachments:["PRIVATE_MEDIA"]},stage:"NORTI_SHAPE_ROOT_FIELDS"},
  {obj:{...base,media:{data:"PRIVATE_MEDIA"}},stage:"NORTI_SHAPE_ROOT_FIELDS"}
 ];
 for(const x of bads){
  const e=env();
  const r=e.invoke({...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},body:JSON.stringify(x.obj)});
  assert.equal(r.returned[0].response.status,502);
  assert.ok(e.logs.includes("[AIES_V06] "+x.stage));
  assert.ok(e.logs.includes("[AIES_V06] REQUEST_DIAG_INPUT_UNSUPPORTED"));
  assert.equal(e.requests.length,0);
  assert.ok(e.logs.every(l=>!l.includes("PRIVATE_MEDIA")&&!l.includes("TOOL_LIST")&&!l.includes("PRIVATE_HINT")));
 }
});
test("confirmed noRTI wrapper only accepts message discriminator and refuses tool calls",()=>{
 const group="siri.multimodal.noRTI";
 for(const [wrap,stage] of [
  [{type:"function_call",message:{role:"user",content:"SAFE"}},"NORTI_SHAPE_WRAPPER_TYPE_UNSUPPORTED"],
  [{type:"audio",message:{role:"user",content:"SAFE"}},"NORTI_SHAPE_WRAPPER_TYPE_UNSUPPORTED"],
  [{type:"message",message:{role:"tool",content:"SAFE"}},"NORTI_SHAPE_ROLE_UNSUPPORTED"],
  [{type:"message",message:{role:"user",content:"SAFE"},call_id:"PRIVATE_ID"},"NORTI_SHAPE_ITEM_WRAPPER_FIELDS"]
 ]){
  const e=env();
  const body=JSON.stringify({configuration:{response_configuration_group_id:group},input:[wrap]});
  const r=e.invoke({...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},body});
  assert.equal(r.returned[0].response.status,502);
  assert.ok(e.logs.includes("[AIES_V06] "+stage));
  assert.equal(e.requests.length,0);
  assert.ok(e.logs.every(l=>!l.includes("PRIVATE_ID")));
 }
});
test("noRTI unsupported nested content types produce only fixed diagnostics",()=>{
 const group="siri.multimodal.noRTI";
 const values=[
  [{type:"image",data:"PRIVATE_IMAGE"}],
  [["PRIVATE_NESTED_ARRAY"]],
  [42]
 ];
 for(const content of values){
  const e=env();
  const body=JSON.stringify({configuration:{response_configuration_group_id:group},
   input:[{type:"message",message:{role:"user",content}}]});
  const r=e.invoke({...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},body});
  assert.equal(r.returned[0].response.status,502);
  assert.ok(e.logs.includes("[AIES_V06] REQUEST_DIAG_CONTENT_UNSUPPORTED"));
  assert.ok(e.logs.some(x=>x.startsWith("[AIES_V06] NORTI_CONTENT_")));
  assert.equal(e.requests.length,0);
  assert.ok(e.logs.every(l=>l.length<100&&!l.includes("PRIVATE")));
 }
});

test("noRTI is denied for non-Siri clients including WritingTools",()=>{
 const body=JSON.stringify({
  configuration:{response_configuration_group_id:"siri.multimodal.noRTI"},
  input:[{content:"SAFE_NONPRIVATE"}]
 });
 for(const userAgent of ["OtherClient (iPad - Version 27.3.0)","", "siri-like (iPad)"]){
  const e=env();
  const r=e.invoke({...e.request,headers:{"User-Agent":userAgent},body});
  assert.equal(r.returned[0].response.status,502);
  assert.ok(e.logs.includes("[AIES_V06] REQUEST_DIAG_GROUP_UNSUPPORTED"));
  assert.ok(!e.logs.includes("[AIES_V06] REQUEST_CAPTURED"));
  assert.equal(e.requests.length,0);
 }
 const e=env();
 const req={...e.request,headers:{"User-Agent":"WritingTools (iPad - Version 27.3.0)"},body};
 assert.equal(e.invoke(req).returned[0].response.status,502);
 assert.equal(e.invoke(req,{status:200,body:fixture}).returned[0].status,502);
 assert.equal(e.requests.length,0);
 assert.ok(e.logs.includes("[AIES_V06] REQUEST_DIAG_WRITING_GROUP_UNVERIFIED"));
});
const writingBody=JSON.stringify({
 configuration:{response_configuration_group_id:"compose_selectedAndAllText"},
 input:[{type:"message",message:{role:"user",content:[{type:"text",text:"请把这段短文改写得清晰自然。"}]}}],
 client_tools:[],server_tools:[],response_format:{type:"json_schema"},stream:true
});
function writingReq(e,body=writingBody){
 return {...e.request,headers:{"Content-Type":"application/json",
  "User-Agent":"WritingTools (iPad - Version 27.3.0)"},body};
}
function completedWritingAnswer(sse){
 const name="session.response.choices[].items[].message.content[].text.value.done";
 const line=sse.split("\n").find(x=>x.startsWith("data: ")&&x.includes('"'+name+'"'));
 return line?JSON.parse(JSON.parse(line.slice(6))[name].value):null;
}
test("exact SAIR WritingTools Compose group is rewritten as body/refinements, not Siri JSON",()=>{
 const e=env(),req=writingReq(e),a=e.invoke(req);
 assert.equal(a.returned.length,1);
 assert.ok(a.returned[0].headers["X-AIES-Request-ID"].startsWith("aies_"));
 const b=e.invoke({...req,headers:{...req.headers,...a.returned[0].headers}},
  {status:200,headers:{"Content-Type":"text/event-stream"},body:fixture});
 assert.equal(b.returned[0].status,200);
 const out=completedWritingAnswer(b.returned[0].body);
 assert.ok(out);
 assert.ok(out.body.startsWith("【DeepSeek · AIES】\n"));
 assert.ok(out.body.includes("DEEPSEEK_EXCLUSIVE_REPLY"));
 assert.ok(Array.isArray(out.refinements)&&out.refinements.length===3);
 assert.equal(Object.prototype.hasOwnProperty.call(out,"content"),false);
 assert.equal(Object.prototype.hasOwnProperty.call(out,"suggestions"),false);
 assert.equal(JSON.parse(e.requests[0].body).messages[1].content,"请把这段短文改写得清晰自然。");
 assert.ok(!b.returned[0].body.includes("QWEN_ORIGINAL_ANSWER_TEST"));
 assert.ok(e.logs.includes("[AIES_V06] WRITINGTOOLS_DEEPSEEK_PAYLOAD_READY"));
 assert.equal(e.data["AIES_R1_"+a.returned[0].headers["X-AIES-Request-ID"]],"");
});
test("WritingTools response recovers scene from an unexpired matching tag when UA is missing",()=>{
 for(const body of [undefined,writingBody]){
  const e=env(),req=writingReq(e),a=e.invoke(req);
  const id=a.returned[0].headers["X-AIES-Request-ID"];
  const responseReq={...req,headers:{"X-AIES-Request-ID":id},body};
  const b=e.invoke(responseReq,{status:200,headers:{"Content-Type":"text/event-stream"},body:fixture});
  assert.equal(b.returned[0].status,200);
  const answer=completedWritingAnswer(b.returned[0].body);
  assert.ok(answer&&answer.body.includes("DEEPSEEK_EXCLUSIVE_REPLY"));
  assert.equal(answer.content,undefined);
  assert.equal(e.requests.length,1);
  assert.ok(e.logs.includes("[AIES_V06] WRITINGTOOLS_SCENE_RECOVERED_FROM_TAG"));
  assert.ok(e.logs.includes("[AIES_V06] WRITINGTOOLS_DEEPSEEK_PAYLOAD_READY"));
 }
});
test("WritingTools tag recovery rejects conflicting explicit client, changed body or missing token",()=>{
 const a=env(),req=writingReq(a),captured=a.invoke(req);
 const id=captured.returned[0].headers["X-AIES-Request-ID"];
 const wrongUA=a.invoke({...req,headers:{"X-AIES-Request-ID":id,"User-Agent":"Siri (iPad - Version 27.3.0)"},body:undefined},
  {status:200,body:fixture});
 assert.equal(wrongUA.returned[0].status,502);
 assert.ok(a.logs.includes("[AIES_V06] ERROR_CORRELATION_MISMATCH"));
 assert.equal(a.requests.length,0);
 const b=env(),req2=writingReq(b),cap2=b.invoke(req2),id2=cap2.returned[0].headers["X-AIES-Request-ID"];
 const changed=b.invoke({...req2,headers:{"X-AIES-Request-ID":id2},
  body:writingBody.replace("清晰自然","内容被替换")},
  {status:200,body:fixture});
 assert.equal(changed.returned[0].status,502);
 assert.ok(b.logs.includes("[AIES_V06] ERROR_CORRELATION_MISMATCH"));
 assert.equal(b.requests.length,0);
 const c=env(),missing=c.invoke({...writingReq(c),headers:{},body:writingBody},
  {status:200,body:fixture});
 assert.equal(missing.returned[0].status,502);
 assert.equal(c.requests.length,0);
 assert.ok(!c.logs.includes("[AIES_V06] WRITINGTOOLS_SCENE_RECOVERED_FROM_TAG"));
});
test("WritingTools Compose rejects media, non-user roles and unverified groups before DeepSeek",()=>{
 const all=[
  {...JSON.parse(writingBody),input:[{type:"message",message:{role:"tool",content:[{type:"text",text:"PRIVATE_TOOL"}]}}]},
  {...JSON.parse(writingBody),input:[{type:"message",message:{role:"user",content:[{type:"image",data:"PRIVATE_MEDIA"}]}}]},
  {...JSON.parse(writingBody),configuration:{response_configuration_group_id:"compose_unverified"}},
  {...JSON.parse(writingBody),input:[{type:"message",message:{role:"user",content:[{type:"text",text:"PRIVATE"}]}}],stream:false},
  {...JSON.parse(writingBody),context:{private:"SECRET_HIDDEN"}}
 ];
 for(const payload of all){
  const e=env(),v=e.invoke(writingReq(e,JSON.stringify(payload)));
  assert.equal(v.returned[0].response.status,502);
  assert.equal(e.requests.length,0);
  assert.ok(e.logs.every(x=>!x.includes("PRIVATE")&&!x.includes("SECRET_HIDDEN")));
 }
});
test("Siri and WritingTools correlation cannot use one another's temporary prompt",()=>{
 const e=env(),wa=e.invoke(writingReq(e)),id=wa.returned[0].headers["X-AIES-Request-ID"];
 const bad=e.invoke({...e.request,headers:{...e.request.headers,"X-AIES-Request-ID":id}},
  {status:200,body:fixture});
 assert.equal(bad.returned[0].status,502);
 assert.equal(e.requests.length,0);
 assert.ok(!JSON.stringify(bad.returned[0]).includes("请把这段"));
});

test("noRTI fail-closes unverified and multimodal request shapes without billing model",()=>{
 const group="siri.multimodal.noRTI";
 const configs=[
  {configuration:{response_configuration_group_id:group},input:[{content:"SAFE"}],attachments:[{type:"image",data:"PRIVATE"}]},
  {configuration:{response_configuration_group_id:group},input:[{content:"SAFE",audio:"PRIVATE"}]},
  {configuration:{response_configuration_group_id:group},input:[{content:"SAFE",metadata:{file:"PRIVATE"}}]},
  {configuration:{response_configuration_group_id:group},input:[{message:{content:"SAFE",image_url:"PRIVATE"}}]},
  {configuration:{response_configuration_group_id:group},input:[{role:"assistant",content:"SAFE"}]},
  {configuration:{response_configuration_group_id:group},input:[{type:"image",content:"SAFE"}]},
  {configuration:{response_configuration_group_id:group},input:[{message:{content:"SAFE"},attachment:"PRIVATE"}]},
  {configuration:{response_configuration_group_id:group},input:[{content:{type:"image",url:"PRIVATE"}}]},
  {configuration:{response_configuration_group_id:group},input:[{content:"data:audio/mp3;base64,PRIVATE"}]},
  {configuration:{response_configuration_group_id:group},input:[]}
 ];
 for(const obj of configs){
  const e=env();
  const r=e.invoke({...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)",
   Authorization:"Bearer TEST_PRIVATE_AUTH"},body:JSON.stringify(obj)});
  assert.equal(r.returned[0].response.status,502,JSON.stringify(obj).slice(0,75));
  assert.ok(e.logs.some(x=>x==="[AIES_V06] REQUEST_DIAG_INPUT_UNSUPPORTED"||
   x==="[AIES_V06] REQUEST_DIAG_CONTENT_UNSUPPORTED"||
   x==="[AIES_V06] REQUEST_DIAG_MEDIA_UNSUPPORTED"));
  assert.equal(e.requests.length,0);
  assert.ok(e.logs.every(x=>!x.includes("PRIVATE")&&!x.includes("TEST_PRIVATE_AUTH")));
 }
});
test("noRTI accepted group does not silently accept unknown neighboring groups",()=>{
 for(const group of ["siri.multimodal","siri.multimodal.noRTI.extra","SIRI.MULTIMODAL.NORTI"]){
  const e=env();
  const body=JSON.stringify({configuration:{response_configuration_group_id:group},input:[{content:"SAFE"}]});
  const r=e.invoke({...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},body});
  assert.equal(r.returned[0].response.status,502);
  assert.ok(e.logs.includes("[AIES_V06] REQUEST_DIAG_GROUP_UNSUPPORTED"));
  assert.equal(e.requests.length,0);
 }
});

test("WritingTools unknown groups fail closed without DeepSeek, even when diagnostic is armed",()=>{
 const e=env();
 runLocal(e);
 const req={...e.request,headers:{"User-Agent":"WritingTools (iPad - Version 27.3.0)"}};
 const first=e.invoke(req);
 const second=e.invoke(req,{status:200,body:fixture});
 assert.equal(first.returned[0].response.status,502);
 assert.equal(second.returned[0].status,502);
 assert.equal(probeState(e).writingToolsSeen,1);
 assert.equal(probeState(e).siriSeen,0);
 assert.equal(e.requests.length,0);
 assert.ok(!e.logs.includes("[AIES_V06] WRITINGTOOLS_COMPOSE_SCOPED"));
 assert.ok(e.logs.includes("[AIES_V06] REQUEST_DIAG_WRITING_GROUP_UNVERIFIED"));
});
test("unarmed unknown Siri group fails closed and creates no v2 diagnostic state",()=>{
 const e=env();
 const r=sirireq(e,"siri.unknown");
 assert.equal(r.returned[0].response.status,502);
 assert.equal(e.data.AIES_SIRI_GROUP_PROBE_V2_STATE,undefined);
 assert.equal(e.requests.length,0);
 assert.ok(e.logs.includes("[AIES_V06] REQUEST_DIAG_GROUP_UNSUPPORTED"));
});
test("probe arms 600s and status checks never disarm it",()=>{
 const e=env();
 const first=runLocal(e);
 assert.ok(first.logs.includes("[AIES_SIRI_GROUP_LOCAL] ARMED_600_SECONDS"));
 assert.ok(first.logs.includes("[AIES_SIRI_GROUP_LOCAL] PERSISTENCE_ROUNDTRIP_OK"));
 const before=e.data.AIES_SIRI_GROUP_PROBE_V2_STATE;
 for(let i=0;i<3;i++){
  const status=runLocal(e);
  assert.ok(status.logs.some(v=>v.includes("ACTIVE_REMAINING_SECONDS=")));
  assert.ok(status.logs.includes("[AIES_SIRI_GROUP_LOCAL] STILL_ARMED"));
  assert.ok(status.logs.includes("[AIES_SIRI_GROUP_LOCAL] SIRI_REQUESTS_SEEN=0"));
  assert.equal(e.data.AIES_SIRI_GROUP_PROBE_V2_STATE,before);
 }
});
test("probe captures Siri group and discloses it only during explicit manual test, then clears",()=>{
 const e=env();
 runLocal(e);
 const id="siri.real_group";
 const r=sirireq(e,id,"Siri (iPad - Version 27.3.0)","VERY_PRIVATE_PROMPT");
 assert.equal(r.returned[0].response.status,502);
 assert.equal(e.requests.length,0);
 assert.ok(e.logs.includes("[AIES_V06] SIRI_GROUP_CAPTURED_LOCAL"));
 assert.ok(e.logs.includes("[AIES_V06] REQUEST_DIAG_GROUP_UNSUPPORTED"));
 assert.ok(e.logs.every(x=>!x.includes(id)&&!x.includes("VERY_PRIVATE_PROMPT")&&!x.includes("PRIVATE_SECRET")));
 assert.equal(probeState(e).phase,"captured");
 assert.equal(probeState(e).groupId,id);
 const result=runLocal(e);
 assert.ok(result.logs.includes("[AIES_SIRI_GROUP_LOCAL] GROUP_ID="+id));
 assert.ok(result.logs.includes("[AIES_SIRI_GROUP_LOCAL] SIRI_REQUESTS_SEEN=1"));
 assert.ok(result.logs.includes("[AIES_SIRI_GROUP_LOCAL] LAST_STAGE=GROUP_CAPTURED"));
 assert.equal(e.data.AIES_SIRI_GROUP_PROBE_V2_STATE,"");
 // Additional manual run starts a new session; no accidental empty-state cancellation.
 assert.ok(runLocal(e).logs.includes("[AIES_SIRI_GROUP_LOCAL] ARMED_600_SECONDS"));
});
test("one-shot capture persists until manual inspection and is never overwritten",()=>{
 const e=env();
 runLocal(e);
 sirireq(e,"siri.first");
 const first=e.data.AIES_SIRI_GROUP_PROBE_V2_STATE;
 sirireq(e,"siri.second");
 assert.equal(e.data.AIES_SIRI_GROUP_PROBE_V2_STATE,first);
 assert.ok(runLocal(e).logs.includes("[AIES_SIRI_GROUP_LOCAL] GROUP_ID=siri.first"));
});
test("unexpected clients do not capture identifiers, but are counted without logging headers",()=>{
 const e=env();
 runLocal(e);
 const r=sirireq(e,"siri.actual","OtherClient (iPad - Version 27.3.0)");
 assert.equal(r.returned[0].response.status,502);
 assert.equal(probeState(e).phase,"armed");
 assert.equal(probeState(e).otherClientSeen,1);
 assert.equal(probeState(e).siriSeen,0);
 assert.equal(probeState(e).groupId,undefined);
 assert.ok(e.logs.includes("[AIES_V06] SIRI_PROBE_OTHER_CLIENT_SEEN"));
 assert.ok(e.logs.every(x=>!x.includes("OtherClient")&&!x.includes("PRIVATE_SECRET")));
});
test("unsafe group identifiers are not stored; safer later Siri group can still be captured",()=>{
 const e=env();
 runLocal(e);
 const unsafe="PRIVATEACCESS"+("A".repeat(50));
 sirireq(e,unsafe);
 assert.equal(probeState(e).phase,"armed");
 assert.equal(probeState(e).groupId,undefined);
 assert.equal(probeState(e).lastCode,"GROUP_ID_UNSAFE");
 assert.ok(e.logs.includes("[AIES_V06] SIRI_GROUP_PROBE_UNSAFE_ID"));
 const status=runLocal(e);
 assert.ok(status.logs.includes("[AIES_SIRI_GROUP_LOCAL] STILL_ARMED"));
 assert.ok(status.logs.includes("[AIES_SIRI_GROUP_LOCAL] LAST_STAGE=GROUP_ID_UNSAFE"));
 sirireq(e,"siri.safe_id");
 assert.equal(probeState(e).phase,"captured");
 assert.ok(!e.logs.some(x=>x.includes(unsafe)));
});
test("Siri parse failure stages are reported without storing request text",()=>{
 const e=env();
 runLocal(e);
 const req={...e.request,body:"PRIVATE_INVALID_JSON",headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"}};
 const a=e.invoke(req);
 assert.equal(a.returned[0].response.status,502);
 assert.equal(probeState(e).lastCode,"JSON_INVALID");
 assert.equal(probeState(e).siriSeen,1);
 const status=runLocal(e);
 assert.ok(status.logs.includes("[AIES_SIRI_GROUP_LOCAL] LAST_STAGE=JSON_INVALID"));
 assert.ok(status.logs.includes("[AIES_SIRI_GROUP_LOCAL] STILL_ARMED"));
 assert.ok(status.logs.every(x=>!x.includes("PRIVATE_INVALID_JSON")));
});
test("non-POST Siri traffic cannot be used to collect group metadata",()=>{
 const e=env();
 runLocal(e);
 const body=JSON.stringify({configuration:{response_configuration_group_id:"siri.unsafe_method"},input:[{content:"SAFE"}]});
 const r=e.invoke({...e.request,method:"GET",headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},body});
 assert.equal(r.returned[0].response.status,502);
 assert.equal(probeState(e).phase,"armed");
 assert.equal(probeState(e).siriSeen,0);
 assert.equal(probeState(e).groupId,undefined);
 assert.ok(e.logs.includes("[AIES_V06] SIRI_PROBE_NON_POST_IGNORED"));
});

test("response hook cannot consume opt-in or update counters",()=>{
 const e=env();
 runLocal(e);
 const body=JSON.stringify({configuration:{response_configuration_group_id:"siri.unrecognized"},input:[{content:"SAFE"}]});
 const res=e.invoke({...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},body},{status:200,body:fixture});
 assert.equal(res.returned[0].status,502);
 assert.equal(probeState(e).siriSeen,0);
 assert.equal(probeState(e).phase,"armed");
});
test("expired status is explicit and cleanup never silently re-arms",()=>{
 const e=env();
 runLocal(e);
 const st=probeState(e);
 st.createdAt=Date.now()-1200000;
 st.expiresAt=Date.now()-600000;
 st.siriSeen=2;
 st.lastCode="GROUP_UNSUPPORTED";
 e.data.AIES_SIRI_GROUP_PROBE_V2_STATE=JSON.stringify(st);
 const out=runLocal(e);
 assert.ok(out.logs.includes("[AIES_SIRI_GROUP_LOCAL] EXPIRED_CLEARED"));
 assert.equal(e.data.AIES_SIRI_GROUP_PROBE_V2_STATE,"");
 assert.ok(runLocal(e).logs.includes("[AIES_SIRI_GROUP_LOCAL] ARMED_600_SECONDS"));
});
test("manual STOP clears probe, legacy keys, and never touches DeepSeek Key",()=>{
 const e=env();
 runLocal(e);
 e.data.AIES_SIRI_GROUP_PROBE_ARM="legacy";
 e.data.AIES_SIRI_GROUP_PROBE_RESULT="old_group_string";
 const result=runLocal(e,localStop);
 assert.ok(result.logs.includes("[AIES_SIRI_GROUP_LOCAL] PROBE_STOPPED_AND_CLEARED"));
 assert.equal(e.data.AIES_SIRI_GROUP_PROBE_V2_STATE,"");
 assert.equal(e.data.AIES_SIRI_GROUP_PROBE_ARM,"");
 assert.equal(e.data.AIES_SIRI_GROUP_PROBE_RESULT,"");
 assert.equal(e.data.SAIRS_DEEPSEEK_API_KEY,KEY);
 assert.ok(runLocal(e).logs.includes("[AIES_SIRI_GROUP_LOCAL] ARMED_600_SECONDS"));
});
test("local helper detects write failure instead of claiming it is armed",()=>{
 const e=env();
 const noWrite={read:()=>null,write:()=>false};
 assert.ok(runLocal(e,localProbe,noWrite).logs.includes("[AIES_SIRI_GROUP_LOCAL] PERSISTENCE_ROUNDTRIP_FAILED"));
 assert.ok(runLocal(e,localStop,noWrite).logs.includes("[AIES_SIRI_GROUP_LOCAL] PROBE_STOP_FAILED"));
});

function schemaState(e){return JSON.parse(e.data.AIES_NORTI_SCHEMA_PROBE_V1_STATE);}
function schemaBadRequest(e,extras={}){
 const req={...e.request,
  headers:{"User-Agent":"Siri (iPad - Version 27.3.0)",Authorization:"Bearer PRIVATE_SECRET"},
  body:JSON.stringify({
   configuration:{response_configuration_group_id:"siri.multimodal.noRTI"},
   input:[{message:{content:"PRIVATE_SIRI_QUESTION",role:"user"},type:"message",index:1}],
   metadata:{client:"PRIVATE_CLIENT_DETAIL"},stream:false,...extras
  })};
 return e.invoke(req);
}
test("schema probe manual arm is opt-in, repeat status does not cancel",()=>{
 const e=env();
 schemaBadRequest(e);
 assert.equal(e.data.AIES_NORTI_SCHEMA_PROBE_V1_STATE,undefined);
 assert.ok(!e.logs.includes("[AIES_V06] NORTI_SCHEMA_CAPTURED_LOCAL"));
 const a=runLocal(e,schemaProbe);
 assert.ok(a.logs.includes("[AIES_SIRI_SCHEMA_LOCAL] ARMED_600_SECONDS"));
 assert.ok(a.logs.includes("[AIES_SIRI_SCHEMA_LOCAL] PERSISTENCE_ROUNDTRIP_OK"));
 const saved=e.data.AIES_NORTI_SCHEMA_PROBE_V1_STATE;
 for(let i=0;i<2;i++){
  const b=runLocal(e,schemaProbe);
  assert.ok(b.logs.includes("[AIES_SIRI_SCHEMA_LOCAL] STILL_ARMED"));
  assert.ok(b.logs.some(x=>x.includes("ACTIVE_REMAINING_SECONDS=")));
  assert.equal(saved,e.data.AIES_NORTI_SCHEMA_PROBE_V1_STATE);
 }
});
test("opt-in schema probe stores only bounded field names and fixed types; manual read erases before display",()=>{
 const e=env();
 runLocal(e,schemaProbe);
 const response=schemaBadRequest(e);
 assert.equal(response.returned[0].response.status,502);
 assert.equal(e.requests.length,0);
 assert.ok(e.logs.includes("[AIES_V06] NORTI_SCHEMA_CAPTURED_LOCAL"));
 const state=schemaState(e);
 assert.equal(state.phase,"captured");
 assert.equal(state.inputType,"array");
 assert.ok(state.root.some(x=>x.name==="metadata"&&x.type==="object"));
 assert.ok(state.root.some(x=>x.name==="stream"&&x.type==="boolean"));
 assert.ok(state.wrapper.some(x=>x.name==="type"&&x.type==="string"));
 assert.ok(state.wrapper.some(x=>x.name==="index"&&x.type==="number"));
 assert.ok(state.message.some(x=>x.name==="content"&&x.type==="string"));
 assert.ok(!JSON.stringify(state).includes("PRIVATE"));
 assert.ok(!e.logs.some(x=>x.includes("PRIVATE")||x.includes("metadata")||x.includes("stream")));
 const manual=runLocal(e,schemaProbe);
 assert.ok(manual.logs.includes("[AIES_SIRI_SCHEMA_LOCAL] SCHEMA_CAPTURED"));
 assert.ok(manual.logs.includes("[AIES_SIRI_SCHEMA_LOCAL] ROOT_EXTRA_FIELDS=metadata:object,stream:boolean"));
 assert.ok(manual.logs.includes("[AIES_SIRI_SCHEMA_LOCAL] ITEM_WRAPPER_EXTRA_FIELDS=type:string,index:number"));
 assert.ok(manual.logs.includes("[AIES_SIRI_SCHEMA_LOCAL] MESSAGE_FIELD_TYPES=content:string,role:string"));
 assert.ok(manual.logs.includes("[AIES_SIRI_SCHEMA_LOCAL] SCHEMA_CLEARED"));
 assert.ok(manual.logs.every(x=>!x.includes("PRIVATE")));
 assert.equal(e.data.AIES_NORTI_SCHEMA_PROBE_V1_STATE,"");
 assert.ok(runLocal(e,schemaProbe).logs.includes("[AIES_SIRI_SCHEMA_LOCAL] ARMED_600_SECONDS"));
});
test("schema key screening hides identifiers and secret-looking field names",()=>{
 const e=env();
 runLocal(e,schemaProbe);
 schemaBadRequest(e,{
  Authorization:"PRIVATE_ACCESS",
  session_id:"PRIVATE_SESSION_VALUE",
  ["A".repeat(26)]:"PRIVATE_DANGEROUS_VALUE"
 });
 const st=schemaState(e);
 assert.ok(st.root.some(x=>x.name==="REDACTED"));
 assert.ok(!JSON.stringify(st).includes("Authorization"));
 assert.ok(!JSON.stringify(st).includes("session_id"));
 assert.ok(!JSON.stringify(st).includes("PRIVATE"));
 const logs=runLocal(e,schemaProbe).logs.join("\n");
 assert.ok(logs.includes("REDACTED:string"));
 assert.ok(!logs.includes("Authorization")&&!logs.includes("session_id")&&!logs.includes("PRIVATE"));
});
test("schema probe never records WritingTools, other clients, response hooks or non-POST",()=>{
 const cases=[
  {ua:"WritingTools (iPad - Version 27.3.0)",method:"POST"},
  {ua:"OtherClient (iPad - Version 27.3.0)",method:"POST"},
  {ua:"Siri (iPad - Version 27.3.0)",method:"GET"}
 ];
 for(const c of cases){
  const e=env();
  runLocal(e,schemaProbe);
  const request={...e.request,method:c.method,headers:{"User-Agent":c.ua},
   body:JSON.stringify({configuration:{response_configuration_group_id:"siri.multimodal.noRTI"},
    input:[{message:{content:"SAFE"},index:1}],metadata:{safe:false}})};
  e.invoke(request);
  assert.equal(schemaState(e).phase,"armed");
  assert.ok(!e.logs.includes("[AIES_V06] NORTI_SCHEMA_CAPTURED_LOCAL"));
  assert.equal(e.requests.length,0);
 }
 const e=env();
 runLocal(e,schemaProbe);
 e.invoke({...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},
  body:JSON.stringify({configuration:{response_configuration_group_id:"siri.multimodal.noRTI"},input:[{message:{content:"SAFE"},index:1}]})},
  {status:200,body:fixture});
 assert.equal(schemaState(e).phase,"armed");
});
test("captured schema metadata is single-shot and unaffected by later rejected requests",()=>{
 const e=env();
 runLocal(e,schemaProbe);
 schemaBadRequest(e);
 const first=e.data.AIES_NORTI_SCHEMA_PROBE_V1_STATE;
 schemaBadRequest(e,{metadata:"PRIVATE_SECOND_QUESTION"});
 assert.equal(e.data.AIES_NORTI_SCHEMA_PROBE_V1_STATE,first);
});
test("schema probe expires with explicit status and STOP does not touch model Key",()=>{
 const e=env();
 runLocal(e,schemaProbe);
 const state=schemaState(e);
 state.createdAt=Date.now()-1200000;
 state.expiresAt=Date.now()-600000;
 e.data.AIES_NORTI_SCHEMA_PROBE_V1_STATE=JSON.stringify(state);
 const expired=runLocal(e,schemaProbe);
 assert.ok(expired.logs.includes("[AIES_SIRI_SCHEMA_LOCAL] EXPIRED_CLEARED"));
 assert.equal(e.data.AIES_NORTI_SCHEMA_PROBE_V1_STATE,"");
 assert.ok(runLocal(e,schemaProbe).logs.includes("[AIES_SIRI_SCHEMA_LOCAL] ARMED_600_SECONDS"));
 const stop=runLocal(e,schemaStop);
 assert.ok(stop.logs.includes("[AIES_SIRI_SCHEMA_LOCAL] SCHEMA_PROBE_STOPPED_AND_CLEARED"));
 assert.equal(e.data.AIES_NORTI_SCHEMA_PROBE_V1_STATE,"");
 assert.equal(e.data.SAIRS_DEEPSEEK_API_KEY,KEY);
});
test("schema probe persistence errors never claim a successful arm or stop",()=>{
 const e=env();
 const bad={read:()=>null,write:()=>false};
 assert.ok(runLocal(e,schemaProbe,bad).logs.includes("[AIES_SIRI_SCHEMA_LOCAL] PERSISTENCE_ROUNDTRIP_FAILED"));
 assert.ok(runLocal(e,schemaStop,bad).logs.includes("[AIES_SIRI_SCHEMA_LOCAL] STOP_FAILED"));
});

function qwenBodyState(e){return JSON.parse(e.data.AIES_QWEN_BODY_PROBE_V1_STATE);}
function makeQwenTestReq(e){
 return {...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)",Authorization:"Bearer PRIVATE_HEADER"},
  body:JSON.stringify({
   configuration:{response_configuration_group_id:"siri.multimodal.noRTI"},
   client_tools:[{instructions:"PRIVATE_TOOL_SYSTEM_PROMPT"}],
   server_tools:[{url:"https://PRIVATE_TOOL_ENDPOINT"}],
   response_format:{private:"PRIVATE_RESPONSE_META"},
   stream:true,input_hint:"PRIVATE_DEVICE_CONTEXT",
   input:[{type:"message",message:{role:"user",content:[{type:"text",text:{value:"What is photosynthesis?"}}]}}],
   surprising_extra:"PRIVATE_ROOT_CONTEXT"
  })};
}
test("one-shot Qwen body capture is opt-in and captures only after local arm",()=>{
 const e=env(),r=makeQwenTestReq(e);
 const before=e.invoke(r);
 assert.equal(before.returned[0].response.status,502);
 assert.equal(e.data.AIES_QWEN_BODY_PROBE_V1_STATE,undefined);
 const arm=runLocal(e,bodyProbe);
 assert.ok(arm.logs.includes("[AIES_QWEN_BODY_LOCAL] ARMED_600_SECONDS"));
 assert.ok(arm.logs.includes("[AIES_QWEN_BODY_LOCAL] PERSISTENCE_ROUNDTRIP_OK"));
 const saved=e.data.AIES_QWEN_BODY_PROBE_V1_STATE;
 const repeat=runLocal(e,bodyProbe);
 assert.ok(repeat.logs.includes("[AIES_QWEN_BODY_LOCAL] STILL_ARMED"));
 assert.equal(saved,e.data.AIES_QWEN_BODY_PROBE_V1_STATE);
 const result=e.invoke(r);
 assert.equal(result.returned[0].response.status,502);
 assert.ok(e.logs.includes("[AIES_V06] QWEN_BODY_CAPTURED_LOCAL"));
 assert.equal(e.requests.length,0);
 assert.equal(qwenBodyState(e).phase,"captured");
});
test("local Qwen capture includes user text and JSON envelope, but never headers or sensitive metadata",()=>{
 const e=env();
 runLocal(e,bodyProbe);
 e.invoke(makeQwenTestReq(e));
 const snap=qwenBodyState(e);
 assert.ok(snap.body.includes("What is photosynthesis?"));
 assert.ok(snap.body.includes("response_configuration_group_id"));
 assert.ok(snap.body.includes("input_hint"));
 assert.ok(snap.body.includes("[REDACTED_CONTEXT]"));
 assert.ok(snap.body.includes("surprising_extra"));
 assert.ok(!snap.body.includes("PRIVATE_HEADER"));
 assert.ok(!snap.body.includes("PRIVATE_DEVICE_CONTEXT"));
 assert.ok(!snap.body.includes("PRIVATE_TOOL_SYSTEM_PROMPT"));
 assert.ok(!snap.body.includes("PRIVATE_RESPONSE_META"));
 assert.ok(!snap.body.includes("PRIVATE_ROOT_CONTEXT"));
 const logs=runLocal(e,bodyProbe).logs;
 assert.ok(logs.includes("[AIES_QWEN_BODY_LOCAL] BODY_CAPTURED_REDACTED_JSON"));
 assert.ok(logs.includes("[AIES_QWEN_BODY_LOCAL] CAPTURE_CLEARED"));
 const body=logs.filter(x=>x.includes("BODY_PART_")&&x.includes("="))
   .map(x=>x.slice(x.indexOf("=")+1)).join("");
 assert.deepEqual(JSON.parse(body),JSON.parse(snap.body));
 assert.equal(e.data.AIES_QWEN_BODY_PROBE_V1_STATE,"");
});
test("Qwen body capture handles secret-shaped fields and model prompts with masking",()=>{
 const e=env();
 runLocal(e,bodyProbe);
 const request=makeQwenTestReq(e),obj=JSON.parse(request.body);
 obj.input[0].message.content=[{type:"text",text:{value:"Bearer VERYSECRET1234567890"}}];
 obj.api_key="EXPLICIT_PRIVATE_KEY";
 obj.user_email="test-person@example.org";
 obj.input[0].message.device_token="EXPLICIT_DEVICE_TOKEN";
 request.body=JSON.stringify(obj);
 e.invoke(request);
 const str=qwenBodyState(e).body;
 assert.ok(str.includes("[REDACTED_TOKEN]"));
 assert.ok(!str.includes("VERYSECRET1234567890"));
 assert.ok(!str.includes("EXPLICIT_PRIVATE_KEY"));
 assert.ok(!str.includes("test-person@example.org"));
 assert.ok(!str.includes("EXPLICIT_DEVICE_TOKEN"));
 assert.ok(str.includes("[REDACTED_FIELD]"));
 assert.ok(e.logs.every(x=>!x.includes("VERYSECRET")));
});
test("Qwen body capture ignores other clients, WritingTools, non-POST and response hooks",()=>{
 const cases=[
  {ua:"WritingTools (iPad - Version 27.3.0)",method:"POST"},
  {ua:"OtherClient (iPad - Version 27.3.0)",method:"POST"},
  {ua:"Siri (iPad - Version 27.3.0)",method:"GET"}
 ];
 for(const c of cases){
  const e=env();
  runLocal(e,bodyProbe);
  const r=makeQwenTestReq(e);
  e.invoke({...r,method:c.method,headers:{"User-Agent":c.ua}});
  assert.equal(qwenBodyState(e).phase,"armed");
  assert.ok(!e.logs.includes("[AIES_V06] QWEN_BODY_CAPTURED_LOCAL"));
 }
 const e=env();
 runLocal(e,bodyProbe);
 e.invoke(makeQwenTestReq(e),{status:200,body:fixture});
 assert.equal(qwenBodyState(e).phase,"armed");
});
test("Qwen body capture is one-shot and can be explicitly stopped without touching API key",()=>{
 const e=env();
 runLocal(e,bodyProbe);
 e.invoke(makeQwenTestReq(e));
 const first=e.data.AIES_QWEN_BODY_PROBE_V1_STATE;
 const another=makeQwenTestReq(e);
 another.body=another.body.replace("photosynthesis","geography");
 e.invoke(another);
 assert.equal(e.data.AIES_QWEN_BODY_PROBE_V1_STATE,first);
 const stop=runLocal(e,bodyStop);
 assert.ok(stop.logs.includes("[AIES_QWEN_BODY_LOCAL] CAPTURE_STOPPED_AND_CLEARED"));
 assert.equal(e.data.SAIRS_DEEPSEEK_API_KEY,KEY);
 assert.equal(e.data.AIES_QWEN_BODY_PROBE_V1_STATE,"");
});

test("out-of-scope URL is untouched",()=>{
 const e=env();
 const r=e.invoke({url:"https://unrelated.example/test",method:"GET",headers:{}},undefined);
 assert.equal(r.returned.length,1);
 assert.equal(Object.keys(r.returned[0]).length,0);
});

test("upstream metadata cannot smuggle model text into rewritten SSE",()=>{
 const e=env(),a=e.invoke(e.request);
 const malicious=fixture.replace(/"expires_at":\d+/,'"expires_at":"QWEN_SMUGGLED_ANSWER"');
 const b=e.invoke({...e.request,headers:a.returned[0].headers},{body:malicious,status:200});
 assert.equal(b.returned[0].status,502);
 assert.ok(!JSON.stringify(b.returned[0]).includes("QWEN_SMUGGLED_ANSWER"));
});
test("incomplete DeepSeek completion cannot be displayed as a final answer",()=>{
 const e=env(),a=e.invoke(e.request);
 const b=e.invoke({...e.request,headers:a.returned[0].headers},{body:fixture,status:200},{
  post:(opts,cb)=>cb(null,{statusCode:200},JSON.stringify({choices:[{finish_reason:"length",message:{content:"TRUNCATED"}}]}))
 });
 assert.equal(b.returned[0].status,502);
 assert.ok(!JSON.stringify(b.returned[0]).includes("TRUNCATED"));
});

test("upstream unsuccessful response blocks model call and Qwen body",()=>{
 const e=env(),a=e.invoke(e.request);
 const result=e.invoke({...e.request,headers:a.returned[0].headers},{status:503,body:fixture});
 assert.equal(result.returned.length,1);
 assert.equal(result.returned[0].status,502);
 assert.equal(e.requests.length,0);
 assert.ok(!JSON.stringify(result.returned[0]).includes("QWEN_ORIGINAL_ANSWER_TEST"));
});
test("unknown SSE blocks API billing before provider is called",()=>{
 const e=env(),a=e.invoke(e.request);
 const broken=fixture.replace("event: session.created","event: not.supported");
 const result=e.invoke({...e.request,headers:a.returned[0].headers},{status:200,body:broken});
 assert.equal(result.returned[0].status,502);
 assert.equal(e.requests.length,0);
});


function parseSseEntries(raw){
 return raw.trim().split("\n\n").map(f=>{
  const [evt,data]=f.split("\n");
  const name=evt.slice(7),o=JSON.parse(data.slice(6));
  return {name,payload:o[name]};
 });
}
function changeNativeEvent(raw,name,mutate){
 const pieces=raw.trim().split("\n\n");
 const idx=pieces.findIndex(x=>x.startsWith("event: "+name+"\n"));
 assert.ok(idx>=0);
 const lines=pieces[idx].split("\n"),j=JSON.parse(lines[1].slice(6));
 mutate(j[name],j);
 lines[1]="data: "+JSON.stringify(j);
 pieces[idx]=lines.join("\n");
 return pieces.join("\n\n")+"\n\n";
}
test("rewritten DeepSeek SSE follows observed 13-event native Qwen schema, but contains no Qwen answer text",()=>{
 const e=env(),captured=e.invoke(e.request);
 const actual=e.invoke({...e.request,headers:captured.returned[0].headers},
  {status:200,body:fixture});
 assert.equal(actual.returned[0].status,200);
 const rows=parseSseEntries(actual.returned[0].body);
 assert.equal(rows.length,12); // synthetic fixture: one delta (real captures: two)
 const byName=n=>rows.find(x=>x.name===n).payload;
 const s=byName("session.created"),r=byName("session.response.created");
 for(const key of ["expires_at","expires_after","last_active_at","created_at","id","object"])
  assert.ok(Object.hasOwn(s,key),key);
 assert.equal(s.expires_after.anchor,"created_at");
 for(const key of ["notices","session_id","created_at","model","id","choices","object"])
  assert.ok(Object.hasOwn(r,key),key);
 assert.equal(r.session_id,s.id);
 assert.equal(r.model,"aies/deepseek");
 assert.deepEqual(Array.from(r.notices),[]);
 const added=byName("session.response.choices[].added");
 assert.equal(added.index,0);
 assert.deepEqual(Array.from(added.choice.output),[]);
 assert.equal(typeof added.choice.id,"string");
 assert.equal(typeof added.choice.continue_url,"string");
 const item=byName("session.response.choices[].items[].added");
 assert.equal(item.index,0);
 assert.equal(item.item.type,"message");
 assert.equal(item.item.message.role,"assistant");
 const content=byName("session.response.choices[].items[].message.content[].added");
 assert.equal(content.index,0);
 assert.deepEqual(Array.from(content.content.text.annotations),[]);
 const done=byName("session.response.done");
 assert.equal(done.session_id,s.id);
 assert.equal(done.id,r.id);
 assert.equal(done.choices[0].status,"completed");
 assert.equal(done.choices[0].output[0].type,"message");
 assert.equal(done.choices[0].output[0].message.role,"assistant");
 const finalText=done.choices[0].output[0].message.content[0].text.value;
 assert.ok(JSON.parse(finalText).content.startsWith("【DeepSeek · AIES】\n"));
 assert.ok(!actual.returned[0].body.includes("QWEN_ORIGINAL_ANSWER_TEST"));
 assert.equal(Sse.validateCandidateSse(actual.returned[0].body,"siri").ok,true);
});
test("native multi-delta responses create compatible and internally consistent DeepSeek completions",()=>{
 const native=fixture.replace(
 "event: session.response.choices[].items[].message.content[].text.value.delta\n",
 "event: session.response.choices[].items[].message.content[].text.value.delta\n");
 const extra=fixture.trim().split("\n\n");
 const delta=extra.find(x=>x.startsWith("event: session.response.choices[].items[].message.content[].text.value.delta\n"));
 assert.ok(delta);
 extra.splice(extra.indexOf(delta)+1,0,delta,delta);
 const multi=extra.join("\n\n")+"\n\n";
 const e=env(),req=e.invoke(e.request);
 const response=e.invoke({...e.request,headers:req.returned[0].headers},{status:200,body:multi});
 assert.equal(response.returned[0].status,200);
 const rows=parseSseEntries(response.returned[0].body);
 assert.equal(rows.filter(x=>x.name.endsWith(".delta")).length,3);
 assert.equal(Sse.validateCandidateSse(response.returned[0].body,"siri").ok,true);
 assert.ok(!response.returned[0].body.includes("QWEN_ORIGINAL_ANSWER_TEST"));
});
test("live Qwen notices/moderation/tool-call outputs fail closed before invoking DeepSeek",()=>{
 const cases=[
  changeNativeEvent(fixture,"session.response.created",v=>{v.notices=[{text:"QWEN_PRIVATE_WARNING"}];}),
  changeNativeEvent(fixture,"session.response.choices[].done",v=>{v.choice.moderation=[{text:"QWEN_PRIVATE_MODERATION"}];}),
  changeNativeEvent(fixture,"session.response.choices[].items[].added",v=>{v.item.type="function_call";}),
  changeNativeEvent(fixture,"session.response.choices[].items[].done",v=>{v.item.type="function_call";}),
  changeNativeEvent(fixture,"session.response.choices[].completed",v=>{v.choice.output=[{type:"image",data:"QWEN_PRIVATE_MEDIA"}];}),
  changeNativeEvent(fixture,"session.response.choices[].items[].message.content[].added",v=>{v.content.type="audio";})
 ];
 for(const upstream of cases){
  const e=env(),req=e.invoke(e.request);
  const r=e.invoke({...e.request,headers:req.returned[0].headers},{status:200,body:upstream});
  assert.equal(r.returned[0].status,502);
  assert.ok(e.logs.includes("[AIES_V06] ERROR_SSE_REWRITE_UNSUPPORTED"));
  assert.equal(e.requests.length,0);
  assert.ok(!JSON.stringify(r.returned[0]).includes("QWEN_PRIVATE"));
 }
});
test("native text annotations or a non-text content completion fail closed",()=>{
 for(const upstream of [
  changeNativeEvent(fixture,"session.response.choices[].items[].message.content[].done",v=>{
   v.content.type="image";
  }),
  changeNativeEvent(fixture,"session.response.choices[].items[].done",v=>{
   v.item.message.content[0].type="audio";
  })
 ]){
  const e=env(),a=e.invoke(e.request);
  const r=e.invoke({...e.request,headers:a.returned[0].headers},{status:200,body:upstream});
  assert.equal(r.returned[0].status,502);
  assert.equal(e.requests.length,0);
  assert.ok(!JSON.stringify(r.returned[0]).includes("QWEN_ORIGINAL_ANSWER_TEST"));
 }
});
test("opaque Qwen choices and continuation URLs never introduce a foreign endpoint into DeepSeek SSE",()=>{
 let custom=changeNativeEvent(fixture,"session.response.choices[].added",v=>{
  v.choice.id="choice_safe_123";
  v.choice.continue_url="https://untrusted.example.com/PRIVATE_EXFILTRATION";
 });
 const e=env(),req=e.invoke(e.request);
 const r=e.invoke({...e.request,headers:req.returned[0].headers},{status:200,body:custom});
 assert.equal(r.returned[0].status,200);
 const rows=parseSseEntries(r.returned[0].body);
 const choice=rows.find(x=>x.name==="session.response.choices[].added").payload.choice;
 assert.equal(choice.id,"choice_safe_123");
 assert.equal(choice.continue_url,"");
 assert.ok(!r.returned[0].body.includes("PRIVATE_EXFILTRATION"));
});

test("legacy Siri.tqa cannot promote tool/assistant content into DeepSeek user prompt",()=>{
 for(const item of [
  {role:"tool",content:"PRIVATE_TOOL_OUTPUT"},
  {role:"assistant",content:"PRIVATE_ASSISTANT_TEXT"},
  {type:"function_call",content:"PRIVATE_FUNCTION"},
  {type:"image",content:"PRIVATE_IMAGE"}
 ]){
  const e=env();
  const req={...e.request,body:JSON.stringify({
   configuration:{response_configuration_group_id:"siri.tqa"},input:[item]})};
  const result=e.invoke(req);
  assert.equal(result.returned[0].response.status,502);
  assert.ok(e.logs.includes("[AIES_V06] REQUEST_DIAG_INPUT_UNSUPPORTED"));
  assert.equal(e.requests.length,0);
  assert.ok(e.logs.every(x=>!x.includes("PRIVATE_")));
 }
});
test("DeepSeek Flash is requested in documented disabled-thinking mode for short voice answers",()=>{
 const e=env(),a=e.invoke(e.request);
 e.invoke({...e.request,headers:a.returned[0].headers},{status:200,body:fixture});
 assert.equal(e.requests.length,1);
 const sent=JSON.parse(e.requests[0].body);
 assert.equal(sent.model,"deepseek-flash");
 assert.equal(sent.thinking.type,"disabled");
 assert.equal(sent.stream,false);
 assert.equal(sent.max_tokens,1000);
});

test("v0.6 module references an immutable reviewed script commit",()=>{
 const scripts=[...moduleText.matchAll(/script-path=https:\/\/raw\.githubusercontent\.com\/[^\s]+/g)].map(m=>m[0]);
 assert.equal(scripts.length,4);
 assert.ok(scripts.every(x=>x.includes("/7a698fbaadeb37431d9bd1d43df359292ee78ba0/scripts/aies_siri_deepseek_v06.js")));
 assert.ok(!moduleText.includes("scripts/aies_siri_deepseek_beta.js"));
});
test("unsupported response never triggers the model and never returns Qwen text",()=>{
 const e=env(),a=e.invoke(e.request);
 const b=e.invoke({...e.request,headers:a.returned[0].headers},{status:200,body:"QWEN_PLAIN_UNSUPPORTED"});
 assert.equal(e.requests.length,0);
 assert.equal(b.returned[0].status,502);
 assert.ok(!JSON.stringify(b.returned[0]).includes("QWEN_PLAIN_UNSUPPORTED"));
});
