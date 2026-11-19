"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const root=path.join(__dirname,"..");
const runtime=fs.readFileSync(path.join(root,"scripts/aies_qwen_passive_diag.js"),"utf8");
const helper=fs.readFileSync(path.join(root,"scripts/qwen_passive_probe_ONCE.js"),"utf8");
const stop=fs.readFileSync(path.join(root,"scripts/qwen_passive_probe_STOP_ONCE.js"),"utf8");
const moduleText=fs.readFileSync(path.join(root,"shadowrocket/61-AIES-QWEN-PASSIVE-DIAG.sgmodule"),"utf8");
const Sse=require("./fixtures/siri-sse");
const nativeReader=fs.readFileSync(path.join(root,"scripts/ab_native_trace_ONCE.js"),"utf8");
const nativeStop=fs.readFileSync(path.join(root,"scripts/ab_native_trace_STOP_ONCE.js"),"utf8");
const TARGET="https://prod-yabuli.qianwen.com/v1/sessions/responses";
const KEY="AIES_QWEN_PASSIVE_V1_STATE",SECRET="PRIVATE_PERSONAL_PROMPT_OR_TOKEN";
function env(){
 const data={SAIRS_DEEPSEEK_API_KEY:"PRIVATE_DEEPSEEK_API_KEY"},logs=[],sent=[];
 const store={read:k=>data[k]||null,write:(v,k)=>{data[k]=v;return true;}};
 const execute=(script,request,response,storeOverride)=>{
  const returned=[],prints=[];
  const ctx={$request:request,$persistentStore:storeOverride||store,
   $httpClient:{post:x=>sent.push(x)},$done:o=>returned.push(o),Date,Math,
   console:{log:s=>{logs.push(s);prints.push(s);}}};
  if(response!==undefined)ctx.$response=response;
  vm.runInNewContext(script,ctx,{timeout:1000});
  return {returned,prints};
 };
 const local=script=>execute(script,undefined,undefined);
 const invoke=(request,response,override)=>execute(runtime,request,response,override);
 const arm=()=>local(helper);
 const inspect=()=>local(helper);
 const cancel=()=>local(stop);
 const request=(overrides={})=>({
  url:TARGET,method:"POST",headers:{"User-Agent":"Siri (iPad - Version 27.3.0)","Authorization":"Bearer "+SECRET},
  body:JSON.stringify({
   configuration:{response_configuration_group_id:"siri.multimodal.noRTI",
    query:{locale:"zh_CN",platform:"iOS",os_major_version:27,os_minor_version:3,os_patch_version:0,
     device_id:SECRET},secret_token:SECRET},
   input:[{type:"message",message:{role:"user",content:[{type:"text",text:"What is photosynthesis? "+SECRET}]}}],
   input_hint:SECRET,client_tools:[{api_key:SECRET,instructions:SECRET}],
   server_tools:[{tool_token:SECRET}],response_format:{secret:SECRET},stream:true,
   unknown_sensitive:SECRET
  }),...overrides
 });
 return {data,logs,sent,store,arm,inspect,cancel,request,invoke,local};
}
function value(v){return JSON.stringify(v);}
function snap(e){return JSON.parse(e.data[KEY]);}
function unpack(logs,label){
 const chunks=logs.filter(x=>x.includes("[AIES_QWEN_PASSIVE_LOCAL] "+label+"_PART_")&&/PART_\d{3}=/.test(x));
 return chunks.map(x=>x.slice(x.indexOf("=")+1)).join("");
}
test("module is isolated, immutable, pass-through and has two matching passive hooks",()=>{
 assert.ok(moduleText.includes("#!name=AIES 61"));
 const hooks=moduleText.match(/^AIES61 Passive (?:Request|Response) = .*$/gm)||[];
 assert.equal(hooks.length,2); // original structure-only hooks remain intact
 const abHooks=moduleText.match(/^AIES61 Passive Followup (?:Request|Response) = .*$/gm)||[];
 assert.equal(abHooks.length,2);
 assert.ok(abHooks.some(x=>x.includes("type=http-request")));
 assert.ok(abHooks.some(x=>x.includes("type=http-response")));
 assert.ok(hooks.some(x=>x.includes("type=http-request")));
 assert.ok(hooks.some(x=>x.includes("type=http-response")));
 const paths=hooks.map(x=>x.match(/script-path=(\S+)/)?.[1]);
 assert.equal(paths[0],paths[1]);
 assert.match(paths[0],/^https:\/\/raw\.githubusercontent\.com\/Nimenta727\/Apple-Intelligence-Exchange-Secure\/[a-f0-9]{40}\/scripts\/aies_qwen_passive_diag\.js$/);
 assert.ok(!moduleText.includes("DOMAIN,prod-yabuli.qianwen.com,REJECT"));
 assert.ok(!moduleText.includes("api.deepseek.com"));
 assert.ok(!runtime.includes("http.post("));
 assert.ok(!runtime.includes("error("));
});
test("native Qwen A/B opt-in records only controlled client-visible answer and response structures, not tokens",()=>{
 const e=env(),now=Date.now(),key="AIES_AB_NATIVE_V1_STATE";
 e.data[key]=JSON.stringify({v:1,phase:"armed",createdAt:now,expiresAt:now+600000,records:[]});
 const req=e.request(),r=e.invoke(req);
 assert.equal(value(r.returned[0]),"{}");
 const body=Sse.candidateSse("QWEN_USER_VISIBLE_ANSWER",SECRET,"siri");
 const res=e.invoke(req,{status:200,headers:{"Content-Type":"text/event-stream"},body});
 assert.equal(value(res.returned[0]),"{}");
 const records=JSON.parse(e.data[key]).records;
 assert.equal(records.length,2);
 assert.equal(records[0].stage,"NATIVE_REQUEST");
 assert.equal(records[0].shape.bodyStatus,"JSON_OBJECT");
 assert.equal(records[1].stage,"NATIVE_RESPONSE");
 assert.equal(records[1].route,"MAIN");
 assert.equal(records[1].shape.format,"SSE");
 assert.equal(records[1].shape.strict60Preflight,"MATCHES_60_PREFLIGHT");
 assert.ok(records[1].answerChars>0);
 assert.ok(records[1].answerText.includes("QWEN_USER_VISIBLE_ANSWER"));
 assert.ok(!value(records).includes(SECRET));
 assert.ok(!value(records).includes("Bearer"));
 assert.ok(!value(records).includes("Authorization"));
 const read=e.local(nativeReader).prints;
 assert.ok(read.some(x=>x.includes("CAPTURED_LOCAL_READOUT")));
 assert.ok(read.some(x=>x.includes("CAPTURE_CLEARED")));
 assert.equal(e.data[key],"");
});
test("native Qwen A/B records same-question session follow-up without modifying its SSE",()=>{
 const e=env(),now=Date.now(),key="AIES_AB_NATIVE_V1_STATE";
 e.data[key]=JSON.stringify({v:1,phase:"armed",createdAt:now,expiresAt:now+600000,records:[]});
 const req=e.request({url:"https://prod-yabuli.qianwen.com/v1/sessions/PRIVATE_SESSION_UUID/responses"});
 const r=e.invoke(req,{status:200,headers:{"Content-Type":"text/event-stream"},
  body:Sse.candidateSse("FOLLOWUP_PUBLIC_TEST_ANSWER",SECRET,"siri")});
 assert.equal(value(r.returned[0]),"{}");
 const reports=JSON.parse(e.data[key]).records;
 assert.equal(reports.length,1);
 assert.equal(reports[0].route,"SESSION_FOLLOWUP");
 assert.ok(reports[0].answerText.includes("FOLLOWUP_PUBLIC_TEST_ANSWER"));
 assert.ok(!value(reports).includes("PRIVATE_SESSION_UUID"));
 assert.equal(e.sent.length,0);
});
test("native AB capture is fully disabled unless explicitly armed; standalone STOP keeps DeepSeek key",()=>{
 const e=env(),key="AIES_AB_NATIVE_V1_STATE";
 e.invoke(e.request(),{status:200,body:Sse.candidateSse("PUBLIC",SECRET,"siri")});
 assert.equal(e.data[key],undefined);
 const read=e.local(nativeReader).prints;
 assert.ok(read.includes("[AIES_AB_NATIVE_LOCAL] ARMED_600_SECONDS"));
 assert.ok(read.includes("[AIES_AB_NATIVE_LOCAL] PERSISTENCE_ROUNDTRIP_OK"));
 const stop=e.local(nativeStop).prints;
 assert.ok(stop.includes("[AIES_AB_NATIVE_LOCAL] STOPPED_AND_CLEARED"));
 assert.equal(e.data[key],"");
 assert.equal(e.data.SAIRS_DEEPSEEK_API_KEY,"PRIVATE_DEEPSEEK_API_KEY");
});

test("61 strict60 parity accepts annotated complex Qwen SSE without collecting citation contents",()=>{
 const e=env();e.arm();
 const req=e.request(),name="session.response.choices[].items[].message.content[].text.annotations[].added";
 const a={type:name};
 a[name]={choice_index:0,item_index:0,content_index:0,index:0,
  annotation:{url:"https://PRIVATE_QWEN_CITATION.example",title:SECRET}};
 const prefix="event: "+name+"\ndata: "+JSON.stringify(a)+"\n\n";
 const orig=Sse.candidateSse("PUBLIC_ANSWER_TEST","Sample","siri");
 const place="event: session.response.choices[].items[].message.content[].done\n";
 assert.ok(orig.includes(place));
 const withCitation=orig.replace(place,prefix+place);
 const r=e.invoke(req,{status:200,body:withCitation});
 assert.equal(value(r.returned[0]),"{}");
 const st=snap(e);
 assert.equal(st.response.strict60Preflight,"MATCHES_60_PREFLIGHT");
 assert.ok(st.response.eventCounts.some(x=>x.event===name&&x.count===1));
 assert.ok(!value(st).includes("PRIVATE_QWEN_CITATION.example"));
 assert.ok(!value(st).includes(SECRET));
});
test("61 strict60 parity rejects annotations before final answer text",()=>{
 const e=env();e.arm();
 const req=e.request(),name="session.response.choices[].items[].message.content[].text.annotations[].added";
 const a={type:name};a[name]={index:0,annotation:{title:SECRET}};
 const prefix="event: "+name+"\ndata: "+JSON.stringify(a)+"\n\n";
 const orig=Sse.candidateSse("PUBLIC_ANSWER_TEST","Sample","siri");
 const misplaced=orig.replace("event: session.response.choices[].items[].message.content[].text.value.done\n",
  prefix+"event: session.response.choices[].items[].message.content[].text.value.done\n");
 e.invoke(req,{status:200,body:misplaced});
 assert.equal(snap(e).response.strict60Preflight,"ANNOTATION_POSITION_OR_TYPE_UNSUPPORTED");
});

test("default unarmed mode always passes original Qwen traffic without observing body",()=>{
 const e=env();
 const request=e.request();
 const response={status:200,body:Sse.candidateSse(SECRET,SECRET,"siri")};
 for(const result of [e.invoke(request),e.invoke(request,response)]){
  assert.equal(result.returned.length,1);
  assert.equal(value(result.returned[0]),"{}");
 }
 assert.equal(e.data[KEY],undefined);
 assert.equal(e.logs.length,0);
 assert.equal(e.sent.length,0);
});
test("manual arm lasts 600 seconds, status checks never disarm",()=>{
 const e=env();
 const start=e.arm().prints;
 assert.ok(start.includes("[AIES_QWEN_PASSIVE_LOCAL] ARMED_600_SECONDS"));
 assert.ok(start.includes("[AIES_QWEN_PASSIVE_LOCAL] PERSISTENCE_ROUNDTRIP_OK"));
 const before=e.data[KEY];
 for(let i=0;i<3;i++){
  const result=e.inspect().prints;
  assert.ok(result.includes("[AIES_QWEN_PASSIVE_LOCAL] STILL_ARMED"));
  assert.ok(result.some(x=>x.includes("ACTIVE_REMAINING_SECONDS=")));
  assert.equal(e.data[KEY],before);
 }
 assert.equal(e.sent.length,0);
});
test("captures true request field TYPES and allowlisted OS metadata without content values",()=>{
 const e=env();e.arm();
 const r=e.invoke(e.request());
 assert.equal(value(r.returned[0]),"{}");
 const st=snap(e);
 assert.equal(st.request.bodyStatus,"JSON_OBJECT");
 assert.equal(st.request.device.platform,"iOS");
 assert.equal(st.request.device.locale,"zh_CN");
 assert.equal(st.request.device.os_major_version,27);
 assert.equal(st.request.device.os_minor_version,3);
 assert.equal(st.request.device.group,"siri.multimodal.noRTI");
 assert.equal(st.response,null);
 assert.ok(e.logs.includes("[AIES_QWEN_PASSIVE] REQUEST_SCHEMA_CAPTURED_LOCAL"));
 assert.ok(st.request.schema.fields.some(x=>x.key==="configuration"));
 assert.ok(st.request.schema.fields.some(x=>x.key==="input"));
 assert.ok(st.request.schema.fields.some(x=>x.key==="client_tools"));
 assert.ok(st.request.schema.fields.some(x=>x.key==="input_hint"&&x.value==="string"));
 assert.ok(!value(st).includes(SECRET));
 assert.ok(!value(st).includes("photosynthesis"));
 assert.ok(!value(st).includes("Bearer"));
 assert.ok(!value(st).includes("device_id"));
 assert.ok(!value(st).includes("secret_token"));
 assert.equal(e.sent.length,0);
});
test("captures only SSE event name/order/count plus JSON key/type schema, no Qwen text",()=>{
 const e=env();e.arm();
 const original=Sse.candidateSse("QWEN_SENSITIVE_ANSWER",SECRET,"siri");
 e.invoke(e.request());
 const ret=e.invoke(e.request(),{status:200,headers:{"Content-Type":"text/event-stream","Set-Cookie":SECRET},body:original});
 assert.equal(value(ret.returned[0]),"{}");
 const st=snap(e);
 assert.equal(st.response.status,200);
 assert.equal(st.response.format,"SSE");
 assert.equal(st.response.strict60Preflight,"MATCHES_60_PREFLIGHT");
 assert.equal(st.response.eventCounts.length,12);
 assert.equal(st.response.orderFirst.length,12);
 assert.equal(st.response.orderFirst[0],"session.created");
 assert.equal(st.response.orderFirst[11],"session.response.done");
 assert.equal(st.response.jsonDataFrames,12);
 assert.equal(st.response.unparsedFrames,0);
 assert.equal(st.response.schemaExamples[0].event,"session.created");
 assert.ok(st.response.schemaExamples[0].schema.fields.some(x=>x.key==="session.created"));
 assert.ok(!value(st).includes("QWEN_SENSITIVE_ANSWER"));
 assert.ok(!value(st).includes(SECRET));
 assert.ok(!value(st).includes("Set-Cookie"));
 assert.equal(e.sent.length,0);
});
test("passive summarizer preserves unknown SSE event shape safely without accepting answer values",()=>{
 const e=env();e.arm();
 const original=": comment without content\n"+
  "id: PRIVATE_ID\n"+
  "event: session.custom_unknown\n"+
  "data: {\"type\":\"session.custom_unknown\",\"new\":{\"content\":\""+SECRET+"\",\"flags\":[\""+SECRET+"\"]}}\n\n"+
  "event: surprise_PRIVATE_TOKEN\n"+
  "data: [DONE]\n\n";
 const r=e.invoke(e.request(),{status:200,body:original});
 assert.equal(value(r.returned[0]),"{}");
 const resp=snap(e).response;
 assert.equal(resp.format,"SSE");
 assert.equal(resp.framing.comments,true);
 assert.equal(resp.framing.id,true);
 assert.equal(resp.doneMarker,true);
 assert.equal(resp.orderFirst[0],"session.custom_unknown");
 assert.equal(resp.orderFirst[1],"UNSAFE_EVENT_NAME");
 assert.ok(!value(resp).includes(SECRET));
 assert.ok(!value(resp).includes("PRIVATE_ID"));
 assert.ok(!value(resp).includes("surprise_PRIVATE_TOKEN"));
});
function makeFixture(){return Sse.candidateSse("QWEN_PRIVATE_ANSWER",SECRET,"siri");}
function changePayload(raw,eventName,edit){
 const frames=raw.trim().split("\n\n");
 const idx=frames.findIndex(x=>x.startsWith("event: "+eventName+"\n"));
 assert.ok(idx>=0,"fixture event exists");
 const lines=frames[idx].split("\n"),wrapper=JSON.parse(lines[1].slice(6));
 edit(wrapper[eventName],wrapper);
 lines[1]="data: "+JSON.stringify(wrapper);
 frames[idx]=lines.join("\n");
 return frames.join("\n\n")+"\n\n";
}
function observedPreflight(raw){
 const e=env();e.arm();
 const result=e.invoke(e.request(),{status:200,body:raw});
 assert.equal(value(result.returned[0]),"{}");
 assert.equal(e.sent.length,0);
 const summary=snap(e).response;
 assert.ok(!value(summary).includes("QWEN_PRIVATE_ANSWER"));
 assert.ok(!value(summary).includes(SECRET));
 return summary.strict60Preflight;
}
test("passive 61 strict60 preflight classifier matches current rewriteSse branch checks",()=>{
 const stream=makeFixture();
 assert.equal(observedPreflight(stream),"MATCHES_60_PREFLIGHT");
 const first=stream.split("\n\n")[0];
 assert.equal(observedPreflight(first+"\n\n"),"EVENT_COUNT_UNSUPPORTED");
 const addedId=stream.replace("event: session.created\n","id: PRIVATE_ID\nevent: session.created\n");
 assert.equal(observedPreflight(addedId),"FRAME_LAYOUT_UNSUPPORTED");
 const unknown=stream.replace("event: session.created","event: unknown");
 assert.equal(observedPreflight(unknown),"EVENT_UNKNOWN");
 const malformed=stream.replace(/data: \{[^\n]+/,"data: {");
 assert.equal(observedPreflight(malformed),"EVENT_JSON_INVALID");
 const envelope=changePayload(stream,"session.created",(payload,wrapper)=>{
  delete wrapper.type;
 });
 assert.equal(observedPreflight(envelope),"EVENT_ENVELOPE_INVALID");
 const frames=stream.trim().split("\n\n");
 const order=[frames[1],frames[0],...frames.slice(2)].join("\n\n")+"\n\n";
 assert.equal(observedPreflight(order),"EVENT_ORDER_UNSUPPORTED");
 const invalidId=changePayload(stream,"session.created",payload=>{payload.id="session/PRIVATE";});
 assert.equal(observedPreflight(invalidId),"SESSION_OR_RESPONSE_ID_INVALID");
 const link=changePayload(stream,"session.response.created",payload=>{payload.session_id="WRONG_LINK_PRIVATE";});
 assert.equal(observedPreflight(link),"SESSION_LINK_MISMATCH");
 const expires=changePayload(stream,"session.created",payload=>{payload.expires_at="PRIVATE_EXPIRY";});
 assert.equal(observedPreflight(expires),"SESSION_EXPIRY_INVALID");
});
test("preflight classifier never leaks prompt or response content and does not modify HTTP response",()=>{
 const raw=makeFixture(),e=env();e.arm();
 e.invoke(e.request());
 const returned=e.invoke(e.request(),{status:200,body:raw,headers:{"Set-Cookie":SECRET}});
 assert.equal(value(returned.returned[0]),"{}");
 const stored=value(snap(e));
 assert.ok(stored.includes("strict60Preflight"));
 assert.ok(stored.includes("MATCHES_60_PREFLIGHT"));
 assert.ok(!stored.includes(SECRET));
 assert.ok(!stored.includes("QWEN_PRIVATE_ANSWER"));
 assert.ok(!stored.includes("Set-Cookie"));
 assert.equal(e.sent.length,0);
});

test("one request and response each only; never overwrites after repeated Siri activity",()=>{
 const e=env();e.arm();
 e.invoke(e.request());
 const capturedRequest=value(snap(e).request);
 e.invoke(e.request({body:JSON.stringify({configuration:{query:{platform:"macOS"}},input:[]})}));
 assert.equal(value(snap(e).request),capturedRequest);
 const respA={status:200,body:Sse.candidateSse("Answer A",SECRET,"siri")};
 e.invoke(e.request(),respA);
 const capturedResponse=value(snap(e).response);
 e.invoke(e.request(),{status:500,body:SECRET});
 assert.equal(value(snap(e).response),capturedResponse);
 assert.equal(e.sent.length,0);
});
test("WritingTools, non-Siri user agents, GET and other paths never enter capture",()=>{
 for(const over of [
  {headers:{"User-Agent":"WritingTools (iPad - Version 27.3.0)"}},
  {headers:{"User-Agent":"UnknownClient"}},
  {method:"GET"},
  {url:"https://prod-yabuli.qianwen.com/v1/other"}
 ]){
  const e=env();e.arm();const request=e.request(over);
  assert.equal(value(e.invoke(request).returned[0]),"{}");
  assert.equal(value(e.invoke(request,{status:200,body:"event: session.created\ndata: {}\n\n"}).returned[0]),"{}");
  assert.equal(snap(e).request,null);
  assert.equal(snap(e).response,null);
 }
});
test("local manual read outputs bounded structure fragments then clears before second read",()=>{
 const e=env();e.arm();e.invoke(e.request());
 e.invoke(e.request(),{status:200,body:Sse.candidateSse("QWEN_SECRET_ANSWER",SECRET,"siri")});
 const stored=snap(e);
 const read=e.inspect().prints;
 assert.ok(read.includes("[AIES_QWEN_PASSIVE_LOCAL] CAPTURED_LOCAL_PROTOCOL_SCHEMA"));
 assert.ok(read.includes("[AIES_QWEN_PASSIVE_LOCAL] REQUEST_PRESENT=true"));
 assert.ok(read.includes("[AIES_QWEN_PASSIVE_LOCAL] RESPONSE_PRESENT=true"));
 assert.ok(read.includes("[AIES_QWEN_PASSIVE_LOCAL] CAPTURE_CLEARED"));
 assert.deepEqual(JSON.parse(unpack(read,"REQUEST_SCHEMA")),stored.request);
 assert.deepEqual(JSON.parse(unpack(read,"RESPONSE_SSE")),stored.response);
 assert.equal(e.data[KEY],"");
 assert.ok(read.every(x=>!x.includes("QWEN_SECRET_ANSWER")&&!x.includes(SECRET)));
 const again=e.inspect().prints;
 assert.ok(again.includes("[AIES_QWEN_PASSIVE_LOCAL] ARMED_600_SECONDS"));
});
test("response-only observation remains readably distinct from missing request, no invented correlation",()=>{
 const e=env();e.arm();
 e.invoke(e.request(),{status:503,body:"{\"error\":\""+SECRET+"\"}"});
 const read=e.inspect().prints;
 assert.ok(read.includes("[AIES_QWEN_PASSIVE_LOCAL] REQUEST_PRESENT=false"));
 assert.ok(read.includes("[AIES_QWEN_PASSIVE_LOCAL] RESPONSE_PRESENT=true"));
 assert.ok(!read.join("").includes(SECRET));
});
test("expiry, manual STOP and storage failures never modify model Key or Qwen traffic",()=>{
 const e=env();e.arm();
 const old=snap(e);old.createdAt=Date.now()-1200000;old.expiresAt=Date.now()-600000;
 e.data[KEY]=JSON.stringify(old);
 const exp=e.inspect().prints;
 assert.ok(exp.includes("[AIES_QWEN_PASSIVE_LOCAL] EXPIRED_CLEARED"));
 e.arm();
 const stop=e.cancel().prints;
 assert.ok(stop.includes("[AIES_QWEN_PASSIVE_LOCAL] STOPPED_AND_CLEARED"));
 assert.equal(e.data[KEY],"");
 assert.equal(e.data.SAIRS_DEEPSEEK_API_KEY,"PRIVATE_DEEPSEEK_API_KEY");
 const broken={read:()=>null,write:()=>false};
 const error=e.invoke(e.request(),undefined,broken);
 assert.equal(value(error.returned[0]),"{}");
 const l=e.local(helper); // successful normal helper run, no secret exposure
 assert.equal(l.returned.length,1);
});
test("unexpected request/body getters fail open and return empty patch exactly once",()=>{
 const e=env();
 const request={url:TARGET,method:"POST",
  headers:{"User-Agent":"Siri (iPad - Version 27.3.0)"}};
 Object.defineProperty(request,"body",{get(){throw Error("PRIVATE_EXN");}});
 e.arm();
 const result=e.invoke(request);
 assert.equal(result.returned.length,1);
 assert.equal(value(result.returned[0]),"{}");
 assert.ok(e.logs.every(x=>!x.includes("PRIVATE_EXN")));
 assert.equal(e.sent.length,0);
});
