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


function runLocalProbe(e){
 const output=[],logs=[];
 const store={
  read:k=>e.data[k]||null,
  write:(v,k)=>{e.data[k]=v;return true;}
 };
 vm.runInNewContext(localProbe,{$persistentStore:store,Date,
  console:{log:v=>logs.push(v)},$done:()=>output.push(true)},{timeout:1000});
 return {logs,output};
}
test("WritingTools is bypassed on request and response without model calls",()=>{
 const e=env();
 const req={...e.request,headers:{"User-Agent":"WritingTools (iPad - Version 27.3.0)"}};
 const first=e.invoke(req);
 const second=e.invoke(req,{status:200,body:fixture});
 assert.equal(JSON.stringify(first.returned),JSON.stringify([{}]));
 assert.equal(JSON.stringify(second.returned),JSON.stringify([{}]));
 assert.equal(e.requests.length,0);
 assert.ok(e.logs.every(x=>x==="[AIES_V06] WRITINGTOOLS_SKIPPED"));
});
test("unarmed unknown Siri group stays denied and is never stored",()=>{
 const e=env(),id="siri.actual_variant";
 const body=JSON.stringify({configuration:{response_configuration_group_id:id},input:[{content:"NONPRIVATE_QUESTION"}]});
 const result=e.invoke({...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},body});
 assert.equal(result.returned[0].response.status,502);
 assert.equal(e.data.AIES_SIRI_GROUP_PROBE_RESULT,undefined);
 assert.ok(e.logs.includes("[AIES_V06] REQUEST_DIAG_GROUP_UNSUPPORTED"));
 assert.equal(e.requests.length,0);
 assert.ok(!e.logs.some(x=>x.includes(id)||x.includes("NONPRIVATE_QUESTION")));
});
test("manual probe arm, single Siri sample, deliberate local read, and clear",()=>{
 const e=env();
 const armed=runLocalProbe(e);
 assert.ok(armed.logs.includes("[AIES_SIRI_GROUP_LOCAL] ARMED_180_SECONDS"));
 assert.ok(e.data.AIES_SIRI_GROUP_PROBE_ARM);
 const id="siri.sample_group";
 const body=JSON.stringify({configuration:{response_configuration_group_id:id},input:[{content:"VERY_PRIVATE_PROMPT"}]});
 const request={...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)",Authorization:"Bearer PRIVATE_AUTH"},body};
 const r=e.invoke(request);
 assert.equal(r.returned[0].response.status,502);
 assert.equal(e.requests.length,0);
 assert.ok(e.logs.includes("[AIES_V06] SIRI_GROUP_CAPTURED_LOCAL"));
 assert.ok(e.logs.includes("[AIES_V06] REQUEST_DIAG_GROUP_UNSUPPORTED"));
 assert.ok(!e.logs.some(x=>x.includes(id)||x.includes("VERY_PRIVATE_PROMPT")||x.includes("PRIVATE_AUTH")));
 assert.equal(e.data.AIES_SIRI_GROUP_PROBE_ARM,"");
 assert.equal(JSON.parse(e.data.AIES_SIRI_GROUP_PROBE_RESULT).id,id);
 const consumed=runLocalProbe(e);
 assert.deepEqual(consumed.logs,["[AIES_SIRI_GROUP_LOCAL] GROUP_ID="+id]);
 assert.equal(e.data.AIES_SIRI_GROUP_PROBE_RESULT,"");
 assert.equal(e.data.AIES_SIRI_GROUP_PROBE_ARM,"");
});
test("armed probe never captures WritingTools or suspicious identifiers",()=>{
 const e=env();
 runLocalProbe(e);
 const body=JSON.stringify({configuration:{response_configuration_group_id:"writingtools.generic"},input:[{content:"PRIVATE"}]});
 e.invoke({...e.request,headers:{"User-Agent":"WritingTools (iPad - Version 27.3.0)"},body});
 assert.equal(e.data.AIES_SIRI_GROUP_PROBE_RESULT,"");
 assert.ok(e.data.AIES_SIRI_GROUP_PROBE_ARM);
 const badId="PRIVATEACCESS"+("A".repeat(50));
 const siriBody=JSON.stringify({configuration:{response_configuration_group_id:badId},input:[{content:"SAFE_TEST"}]});
 e.invoke({...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},body:siriBody});
 assert.equal(e.data.AIES_SIRI_GROUP_PROBE_ARM,"");
 assert.equal(e.data.AIES_SIRI_GROUP_PROBE_RESULT,"");
 assert.ok(e.logs.includes("[AIES_V06] SIRI_GROUP_PROBE_UNSAFE_ID"));
 assert.ok(!e.logs.some(x=>x.includes(badId)));
 assert.deepEqual(runLocalProbe(e).logs,["[AIES_SIRI_GROUP_LOCAL] ARMED_180_SECONDS"]);
});
test("expired and malformed opt-in state never stores Siri group",()=>{
 const e=env();
 for(const value of ['not-json',JSON.stringify({expiresAt:Date.now()-1000}),JSON.stringify({expiresAt:Date.now()+900000})]){
  e.data.AIES_SIRI_GROUP_PROBE_ARM=value;
  e.data.AIES_SIRI_GROUP_PROBE_RESULT="";
  const body=JSON.stringify({configuration:{response_configuration_group_id:"siri.unrecognized"},input:[{content:"SAFE"}]});
  e.invoke({...e.request,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},body});
  assert.equal(e.data.AIES_SIRI_GROUP_PROBE_RESULT,"");
 }
 assert.equal(e.requests.length,0);
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
 assert.ok(scripts.every(x=>x.includes("/f94a2711ccf96457dbb7e532295666bf5dc31ddb/scripts/aies_siri_deepseek_v06.js")));
 assert.ok(!moduleText.includes("scripts/aies_siri_deepseek_beta.js"));
});
test("unsupported response never triggers the model and never returns Qwen text",()=>{
 const e=env(),a=e.invoke(e.request);
 const b=e.invoke({...e.request,headers:a.returned[0].headers},{status:200,body:"QWEN_PLAIN_UNSUPPORTED"});
 assert.equal(e.requests.length,0);
 assert.equal(b.returned[0].status,502);
 assert.ok(!JSON.stringify(b.returned[0]).includes("QWEN_PLAIN_UNSUPPORTED"));
});
