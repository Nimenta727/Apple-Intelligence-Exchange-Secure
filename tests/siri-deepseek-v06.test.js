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
test("noRTI is denied for non-Siri clients and WritingTools remains bypassed",()=>{
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
 assert.deepEqual(JSON.stringify(e.invoke(req).returned),JSON.stringify([{}]));
 assert.deepEqual(JSON.stringify(e.invoke(req,{status:200,body:fixture}).returned),JSON.stringify([{}]));
 assert.equal(e.requests.length,0);
 assert.ok(e.logs.every(x=>x==="[AIES_V06] WRITINGTOOLS_SKIPPED"));
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

test("WritingTools bypasses both hooks without DeepSeek, even when diagnostic is armed",()=>{
 const e=env();
 runLocal(e);
 const req={...e.request,headers:{"User-Agent":"WritingTools (iPad - Version 27.3.0)"}};
 const first=e.invoke(req);
 const second=e.invoke(req,{status:200,body:fixture});
 assert.deepEqual(JSON.stringify(first.returned),JSON.stringify([{}]));
 assert.deepEqual(JSON.stringify(second.returned),JSON.stringify([{}]));
 assert.equal(probeState(e).writingToolsSeen,1);
 assert.equal(probeState(e).siriSeen,0);
 assert.equal(e.requests.length,0);
 assert.ok(e.logs.includes("[AIES_V06] WRITINGTOOLS_SKIPPED"));
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


test("v0.6 module references an immutable reviewed script commit",()=>{
 const scripts=[...moduleText.matchAll(/script-path=https:\/\/raw\.githubusercontent\.com\/[^\s]+/g)].map(m=>m[0]);
 assert.equal(scripts.length,2);
 assert.ok(scripts.every(x=>x.includes("/bc726e60bdbf810d1edf1dbb62d8e6dc79b69d2d/scripts/aies_siri_deepseek_v06.js")));
 assert.ok(!moduleText.includes("scripts/aies_siri_deepseek_beta.js"));
});
test("unsupported response never triggers the model and never returns Qwen text",()=>{
 const e=env(),a=e.invoke(e.request);
 const b=e.invoke({...e.request,headers:a.returned[0].headers},{status:200,body:"QWEN_PLAIN_UNSUPPORTED"});
 assert.equal(e.requests.length,0);
 assert.equal(b.returned[0].status,502);
 assert.ok(!JSON.stringify(b.returned[0]).includes("QWEN_PLAIN_UNSUPPORTED"));
});
