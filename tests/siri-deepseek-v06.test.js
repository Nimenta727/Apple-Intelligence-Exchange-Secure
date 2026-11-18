"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const Sse=require("./fixtures/siri-sse");
const script=fs.readFileSync(path.join(__dirname,"../scripts/aies_siri_deepseek_v06.js"),"utf8");
const moduleText=fs.readFileSync(path.join(__dirname,"../shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule"),"utf8");
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
 assert.ok(scripts.every(x=>x.includes("/b143280fe95e85fec197366afd735f1d46359e39/scripts/aies_siri_deepseek_v06.js")));
 assert.ok(!moduleText.includes("scripts/aies_siri_deepseek_beta.js"));
});
test("unsupported response never triggers the model and never returns Qwen text",()=>{
 const e=env(),a=e.invoke(e.request);
 const b=e.invoke({...e.request,headers:a.returned[0].headers},{status:200,body:"QWEN_PLAIN_UNSUPPORTED"});
 assert.equal(e.requests.length,0);
 assert.equal(b.returned[0].status,502);
 assert.ok(!JSON.stringify(b.returned[0]).includes("QWEN_PLAIN_UNSUPPORTED"));
});
