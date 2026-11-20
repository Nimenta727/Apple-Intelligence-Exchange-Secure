"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const Sse=require("./fixtures/siri-sse");
const code=fs.readFileSync(path.join(__dirname,"../scripts/aies_siri_deepseek_v08_native_sse.js"),"utf8");
const moduleText=fs.readFileSync(path.join(__dirname,"../shadowrocket/64-AIES-SIRI-DEEPSEEK-V08-NATIVE-SESSION-LOCAL.sgmodule"),"utf8");
const oldModule=fs.readFileSync(path.join(__dirname,"../shadowrocket/62-AIES-SIRI-DEEPSEEK-V06-LOCAL.sgmodule"),"utf8");
const KEY="sk_fake_test_12345678901234567890";
const URL="https://prod-yabuli.qianwen.com/v1/sessions/responses";
function nativeSse(salt="main",answer="QWEN_NATIVE_PRIVATE_ANSWER"){
 return Sse.candidateSse(answer,"Native title","siri",
  {now:()=>1730000000000,id:()=>salt});
}
function requestBody(group="siri.multimodal.noRTI",text="What is Saturn?"){
 return JSON.stringify({configuration:{response_configuration_group_id:group},
  input:[{type:"message",message:{role:"user",content:[{type:"text",text}]}}],
  client_tools:[],server_tools:[],stream:true,response_format:{type:"text"}});
}
function request(body=requestBody(),url=URL,ua="Siri (iPad - Version 27.3.0)"){
 return {url,method:"POST",body,headers:{"Content-Type":"application/json","User-Agent":ua}};
}
function env(){
 const data={SAIRS_DEEPSEEK_API_KEY:KEY},logs=[],sent=[];
 function invoke(req,res,opts={}){
  let returns=[],timers=[];
  const offset=opts.offsetMs||0;
  const NativeDate=class extends Date{static now(){return Date.now()+offset;}};
  const client=opts.client||{post:(params,cb)=>{
   sent.push(params);
   cb(null,{statusCode:200},JSON.stringify({choices:[{
    finish_reason:"stop",message:{role:"assistant",content:"DEEPSEEK_REAL_ANSWER"}}]}));
  }};
  const context={$request:req,$persistentStore:{
    read:k=>Object.prototype.hasOwnProperty.call(data,k)?data[k]:null,
    write:(val,k)=>{data[k]=val;return true;}
   },$httpClient:client,$done:x=>returns.push(x),
   console:{log:x=>logs.push(x)},Date:NativeDate,Math,
   setTimeout:(fn,ms)=>{timers.push({fn,ms});return timers.length;},
   clearTimeout:()=>{}};
  if(res!==undefined)context.$response=res;
  vm.runInNewContext(code,context,{timeout:1500});
  return {returns,timers};
 }
 function capture(req){
  const ret=invoke(req);
  assert.equal(ret.returns.length,1);
  assert.ok(ret.returns[0].headers&&ret.returns[0].headers["X-AIES-Request-ID"],
   "capture should return a correlation header");
  return {...req,headers:{...req.headers,...ret.returns[0].headers}};
 }
 function respond(req,body=nativeSse(),opts={}){
  return invoke(req,{status:200,headers:{"Content-Type":"text/event-stream"},body},opts);
 }
 return {data,logs,sent,invoke,capture,respond};
}
function eventBody(sse,event){
 const f=sse.split("\n\n").find(s=>s.startsWith("event: "+event+"\n"));
 assert.ok(f,"event "+event);
 return JSON.parse(f.split("\n").find(s=>s.startsWith("data: ")).slice(6))[event];
}
function mutateEvent(sse,name,cb){
 const blocks=sse.split("\n\n");
 const idx=blocks.findIndex(x=>x.startsWith("event: "+name+"\n"));
 assert.ok(idx>=0,name);
 const lines=blocks[idx].split("\n");
 const at=lines.findIndex(x=>x.startsWith("data: "));
 const item=JSON.parse(lines[at].slice(6));cb(item[name]);lines[at]="data: "+JSON.stringify(item);blocks[idx]=lines.join("\n");
 return blocks.join("\n\n");
}
function followupSse(sid,salt="next"){
 const native=nativeSse(salt);
 const old=eventBody(native,"session.created").id;
 return native.slice(native.indexOf("event: session.response.created")).split(old).join(sid);
}
function followupBody(pointer,group="siri.multimodal.noRTI"){
 const b=JSON.parse(requestBody(group,"How does it look?"));
 if(pointer!==undefined)b.previous_choice_id=pointer;
 return JSON.stringify(b);
}
test("64 is independent LOCAL and OFF by default, with all four genuine upstream hooks",()=>{
 const h=moduleText.split("\n").filter(x=>x.startsWith("AIES64 "));
 const old=oldModule.split("\n").filter(x=>x.startsWith("AIES60 "));
 assert.equal(h.length,4);assert.equal(old.length,4);
 assert.ok(h.every(x=>x.endsWith(",script-path=Script/aies_siri_deepseek_v08_native_sse.js,enable=false")));
 for(let i=0;i<4;i++)
  assert.equal(h[i].slice(h[i].indexOf(",pattern="),h[i].indexOf(",script-path=")),
   old[i].slice(old[i].indexOf(",pattern="),old[i].indexOf(",script-path=")));
 assert.ok(old.every(x=>x.endsWith(",script-path=Script/aies_siri_deepseek_v06.js,enable=true")));
 assert.ok(!moduleText.includes("script-path=https://"));
 assert.match(moduleText,/ROLLBACK|Rollback|回滚/i);
 assert.ok(code.includes('version:"0.8.0-native-session-beta"'));
});
test("first Siri native session SSE uses the real upstream IDs/model, replacing only DeepSeek text",()=>{
 const e=env(),req=e.capture(request());
 const native=nativeSse(),sid=eventBody(native,"session.created").id;
 const res=e.respond(req,native);
 assert.equal(res.returns.length,1);
 const out=res.returns[0];
 assert.equal(out.status,200);
 assert.ok(e.logs.includes("[AIES_V08] SSE_AUDIT_PASSED"));
 assert.ok(e.logs.includes("[AIES_V08] DEEPSEEK_RESPONSE_ATTEMPTED"));
 assert.equal(Sse.validateCandidateSse(out.body,"siri").ok,true);
 assert.equal(eventBody(out.body,"session.created").id,sid);
 assert.equal(eventBody(out.body,"session.response.created").id,
  eventBody(native,"session.response.created").id);
 assert.equal(eventBody(out.body,"session.response.created").model,
  eventBody(native,"session.response.created").model);
 assert.ok(out.body.includes("【DeepSeek · AIES】"));
 assert.ok(!out.body.includes("QWEN_NATIVE_PRIVATE_ANSWER"));
 assert.ok(e.logs.every(s=>!s.includes(KEY)&&!s.includes("What is Saturn")));
 assert.equal(e.sent.length,1);
});
test("native main + followup preserve same official session, previous choice and DeepSeek-only history",()=>{
 const e=env(),one=e.capture(request()),first=e.respond(one,nativeSse());
 assert.equal(first.returns[0].status,200);
 const out=first.returns[0].body;
 const sid=eventBody(out,"session.created").id;
 const choice=eventBody(out,"session.response.choices[].added").choice.id;
 const url=URL.replace("/sessions/responses","/sessions/"+sid+"/responses");
 const next=e.capture(request(followupBody(choice),url));
 const r2=e.respond(next,followupSse(sid));
 assert.equal(r2.returns[0].status,200);
 assert.equal(eventBody(r2.returns[0].body,"session.response.created").session_id,sid);
 assert.ok(r2.returns[0].body.startsWith("event: session.response.created\n"));
 assert.ok(!r2.returns[0].body.includes("event: session.created\n"));
 assert.ok(!r2.returns[0].body.includes("QWEN_NATIVE_PRIVATE_ANSWER"));
 assert.equal(e.sent.length,2);
 const roles=JSON.parse(e.sent[1].body).messages.map(x=>x.role);
 assert.deepEqual(roles,["system","user","assistant","user"]);
 const wrong=e.invoke(request(followupBody(choice),
  URL.replace("/sessions/responses","/sessions/sess_wrong/responses")));
 assert.equal(wrong.returns[0].response.status,502);
 assert.equal(e.sent.length,2);
});
test("multiple native delta frames are accepted; no assumption that a stream has 27 frames",()=>{
 const e=env(),native=nativeSse();
 const event="session.response.choices[].items[].message.content[].text.value.delta";
 const f=native.split("\n\n").find(x=>x.startsWith("event: "+event+"\n"));
 const json=JSON.parse(f.split("\n")[1].slice(6));
 const text=json[event].delta;const mid=Math.floor(text.length/2);
 json[event].delta=text.slice(0,mid);
 const left="event: "+event+"\ndata: "+JSON.stringify(json);
 json[event].delta=text.slice(mid);
 const right="event: "+event+"\ndata: "+JSON.stringify(json);
 const split=native.replace(f+"\n\n",left+"\n\n"+right+"\n\n");
 const req=e.capture(request());
 const result=e.respond(req,split);
 assert.equal(result.returns[0].status,200);
 assert.ok(e.logs.includes("[AIES_V08] SSE_AUDIT_PASSED"));
});
test("upstream delta and done mismatch fails before any DeepSeek request",()=>{
 const e=env(),req=e.capture(request());
 const changed=mutateEvent(nativeSse(),
  "session.response.choices[].items[].message.content[].text.value.done",
  x=>{x.value="QWEN_DISAGREEMENT";});
 const result=e.respond(req,changed);
 assert.equal(result.returns[0].status,502);
 assert.ok(e.logs.includes("[AIES_V08] SSE_AUDIT_DELTA_DONE_MISMATCH"));
 assert.equal(e.sent.length,0);
});
test("terminal text inconsistency fails before DeepSeek, regardless of valid JSON done",()=>{
 const e=env(),req=e.capture(request());
 const bad=mutateEvent(nativeSse(),"session.response.choices[].done",
  x=>{x.choice.output[0].message.content[0].text.value="QWEN_TAMPERED";});
 const x=e.respond(req,bad);
 assert.equal(x.returns[0].status,502);
 assert.ok(e.logs.includes("[AIES_V08] SSE_AUDIT_TERMINAL_TEXT_MISMATCH"));
 assert.equal(e.sent.length,0);
});
test("out-of-order native SSE frames and session ID mismatch fail closed",()=>{
 for(const kind of ["order","session"]){
  const e=env(),req=e.capture(request());
  let native=nativeSse();
  if(kind==="order"){
   const head="event: session.created\n";
   const first=native.split("\n\n");
   const pos=first.findIndex(x=>x.startsWith(head));
   const temp=first[pos];first[pos]=first[pos+1];first[pos+1]=temp;
   native=first.join("\n\n");
  }else native=mutateEvent(native,"session.response.created",x=>{
   x.session_id="sess_wrong";
  });
  const r=e.respond(req,native);
  assert.equal(r.returns[0].status,502);
  assert.equal(e.sent.length,0);
  assert.ok(e.logs.some(x=>x.includes("SSE_AUDIT_")));
 }
});
test("native Siri scene schema is required even with a complete event sequence",()=>{
 const e=env(),req=e.capture(request());
 const raw=nativeSse();let changed=raw;
 const events=[
  "session.response.choices[].items[].message.content[].text.value.delta",
  "session.response.choices[].items[].message.content[].text.value.done",
  "session.response.choices[].items[].message.content[].done",
  "session.response.choices[].items[].done",
  "session.response.choices[].completed",
  "session.response.choices[].done",
  "session.response.done"
 ];
 for(const name of events)changed=mutateEvent(changed,name,v=>{
  const wrong=JSON.stringify({body:"not a Siri schema",refinements:[]});
  if(name.endsWith("value.delta"))v.delta=wrong;
  if(name.endsWith("value.done"))v.value=wrong;
  if(name.endsWith("content[].done"))v.content.text.value=wrong;
  if(name.endsWith("items[].done"))v.item.message.content[0].text.value=wrong;
  if(name.endsWith("choices[].completed")||name==="session.response.choices[].done")
   v.choice.output[0].message.content[0].text.value=wrong;
  if(name==="session.response.done")
   v.choices[0].output[0].message.content[0].text.value=wrong;
 });
 const r=e.respond(req,changed);
 assert.equal(r.returns[0].status,502);
 assert.ok(e.logs.includes("[AIES_V08] SSE_AUDIT_SCHEMA_SIRI"));
 assert.equal(e.sent.length,0);
});
test("classifies visual and unfamiliar Siri groups without forwarding their media/inputs",()=>{
 const e=env();
 for(const group of ["siri.visualIntelligenceCamera","siri.multimodal.otherUnverified"]){
  const result=e.invoke(request(requestBody(group,"PRIVATE_QUESTION")));
  assert.equal(result.returns[0].response.status,502);
 }
 assert.ok(e.logs.includes("[AIES_V08] SCENE_VISION_UNSUPPORTED"));
 assert.ok(e.logs.includes("[AIES_V08] SCENE_SIRI_GROUP_UNVERIFIED"));
 assert.equal(e.sent.length,0);
 assert.ok(e.logs.every(s=>!s.includes("PRIVATE_QUESTION")));
});
test("unknown prior choice, wrong session and untagged response never use most-recent prompt",()=>{
 const e=env(),req=e.capture(request()),native=nativeSse();
 const sid=eventBody(native,"session.created").id;
 const url=URL.replace("/sessions/responses","/sessions/"+sid+"/responses");
 const follow=e.invoke(request(followupBody("choice_unverified"),url));
 assert.equal(follow.returns[0].response.status,502);
 const untagged=e.respond(request(undefined===null?"":requestBody()),native);
 // Response contains parseable same-transaction request body, so MAIN route may
 // use it; the FOLLOWUP route without a tag must never use global latest.
 const f=e.respond(request(followupBody("choice_unverified"),url),followupSse(sid));
 assert.equal(f.returns[0].status,502);
 assert.ok(e.logs.some(x=>x.includes("QWEN_SESSION_FOLLOWUP_SSE_BLOCKED")));
 assert.equal(e.sent.length,untagged.returns[0].status===200?1:0);
});
test("header loss plus absent request body fails closed rather than guessing other captures",()=>{
 const e=env(),req=e.capture(request()),without={...req,headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"},body:undefined};
 const out=e.respond(without,nativeSse());
 assert.equal(out.returns[0].status,502);
 assert.ok(e.logs.includes("[AIES_V08] CORRELATION_NO_TAG_NO_VALID_BODY"));
 assert.ok(e.logs.includes("[AIES_V08] ERROR_PROMPT_UNAVAILABLE"));
 assert.equal(e.sent.length,0);
});
test("known tagged upstream response saves only bounded timing buckets, not timestamps or IDs",()=>{
 const e=env(),req=e.capture(request());
 const r=e.respond(req,nativeSse());
 assert.equal(r.returns[0].status,200);
 assert.ok(e.logs.some(x=>x.startsWith("[AIES_V08] UPSTREAM_ELAPSED_")));
 assert.ok(e.logs.some(x=>x.startsWith("[AIES_V08] MODEL_ELAPSED_")));
 assert.ok(e.logs.some(x=>x.startsWith("[AIES_V08] END_TO_END_ATTEMPT_")));
 assert.ok(e.logs.every(x=>!/sess_aies_|resp_aies_|choice_aies_/.test(x)));
});
test("estimated Siri window exhaustion returns 502 before billing on slow upstream",()=>{
 const e=env(),req=e.capture(request());
 const result=e.respond(req,nativeSse(),{offsetMs:9000});
 assert.equal(result.returns[0].status,502);
 assert.ok(e.logs.includes("[AIES_V08] SIRI_WINDOW_EXHAUSTED"));
 assert.equal(e.sent.length,0);
});
test("model failure does not return Qwen payload",()=>{
 const e=env(),req=e.capture(request());
 const fail={post:(_opts,cb)=>cb(new Error("offline"),null,"")};
 const r=e.respond(req,nativeSse(),{client:fail});
 assert.equal(r.returns[0].status,502);
 assert.ok(!r.returns[0].body.includes("QWEN_NATIVE_PRIVATE_ANSWER"));
 assert.equal(e.sent.length,0);
});
