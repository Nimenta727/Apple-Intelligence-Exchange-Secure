/*
 * AIES Siri -> DeepSeek native answer rewrite v0.6 clean beta.
 * One file, two Shadowrocket hooks: http-request and http-response.
 * Original request MAY reach Qwen. All observed Siri AI response content
 * must come from DeepSeek; never silently return Qwen in our response hook.
 * NOT a system-level guarantee if MITM/script fails or is bypassed.
 *
 * Original SAIR architecture research: boitar/sair, MIT.
 */
(function () {
"use strict";
var C={
  version:"0.6.0-beta",
  target:/^https:\/\/prod-yabuli\.qianwen\.com\/v1\/sessions\/responses(?:\?[^#]*)?$/i,
  endpoint:"https://api.deepseek.com/chat/completions",
  model:"deepseek-flash",
  keyName:"SAIRS_DEEPSEEK_API_KEY",
  maxRequest:300000,maxPrompt:14000,maxSse:900000,maxAnswer:12000,
  timeoutMs:11000,sessionTtlMs:45000
};
var req=typeof $request!=="undefined" ? $request : null;
var res=typeof $response!=="undefined" ? $response : null;
var store=typeof $persistentStore!=="undefined" ? $persistentStore : null;
var http=typeof $httpClient!=="undefined" ? $httpClient : null;
var finish=typeof $done==="function" ? $done : null;
if(!finish)return;
var once=false,timer=null;
function log(s){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_V06] "+s);}catch(e){}}
function done(data){if(once)return;once=true;if(timer!==null&&typeof clearTimeout==="function")try{clearTimeout(timer);}catch(e){};try{finish(data);}catch(e){log("DONE_EXCEPTION");}}
function error(code){
 log("ERROR_"+code);
 var body=JSON.stringify({error:"AIES_"+code});
 // Directly replace the observed HTTP response with a generic non-model error.
 if(res)done({status:502,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"},body:body});
 else done({response:{status:502,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store"},body:body}});
}
function header(headers,name){
 if(!headers||typeof headers!=="object")return "";
 var ks=Object.keys(headers);
 for(var i=0;i<ks.length;i++)if(ks[i].toLowerCase()===name.toLowerCase())return String(headers[ks[i]]);
 return "";
}
// Only fixed diagnostic codes are logged: never request data, keys or headers.
var requestDiagnostic="UNSET";
function rawRequest(){
 if(!req||typeof req.body!=="string"){requestDiagnostic="BODY_NOT_TEXT";return "";}
 if(!req.body.length){requestDiagnostic="BODY_EMPTY";return "";}
 if(req.body.length>C.maxRequest){requestDiagnostic="BODY_OVERSIZE";return "";}
 return req.body;
}
function textAtom(v){
 if(typeof v==="string")return v;
 if(!v||typeof v!=="object"||Array.isArray(v))return null;
 var keys=Object.keys(v);
 if(!keys.length||!keys.every(function(k){return /^(type|text|input_text|value)$/.test(k);}))return null;
 if(v.type&&!/^(text|input_text)$/.test(v.type))return null;
 var t=typeof v.text!=="undefined"?v.text:typeof v.input_text!=="undefined"?v.input_text:v.value;
 if(typeof t==="string")return t;
 // Restrict nested text containers to a single pure-text value.
 if(t&&typeof t==="object"&&!Array.isArray(t)&&
    Object.keys(t).length===1&&typeof t.value==="string")return t.value;
 return null;
}
// Opt-in local-only v2 diagnostic. One state key avoids ARM/RESULT double-write
// ambiguity. Never log group values, prompt text, headers or credential material.
var GROUP_PROBE_STATE="AIES_SIRI_GROUP_PROBE_V2_STATE";
var GROUP_PROBE_WINDOW_MS=600000;
var requestGroup=null;
function isWritingTools(){
 return /^WritingTools(?:\s|\()/i.test(header(req&&req.headers,"User-Agent"));
}
function isSiriForProbe(){
 return /^Siri\s*\(/i.test(header(req&&req.headers,"User-Agent"));
}
function safeGroupIdentifier(v){
 return typeof v==="string"&&v.length>=2&&v.length<=80&&
   /^[A-Za-z][A-Za-z0-9_.-]*$/.test(v)&&
   !/[A-Za-z0-9]{25,}/.test(v)&&
   !/^(?:bearer|token|secret|sk-)/i.test(v);
}
function readArmedProbe(){
 var raw=storeRead(GROUP_PROBE_STATE),v=null,now=Date.now();
 if(!raw||typeof raw!=="string")return null;
 try{v=JSON.parse(raw);}catch(e){return null;}
 if(!v||v.v!==2||v.phase!=="armed"||
    typeof v.expiresAt!=="number"||!isFinite(v.expiresAt)||
    v.expiresAt<=now||v.expiresAt>now+GROUP_PROBE_WINDOW_MS)return null;
 return v;
}
function cappedCount(v){
 return typeof v==="number"&&isFinite(v)&&v>=0?Math.min(9,Math.floor(v)+1):1;
}
function probeObserveWritingTools(){
 if(res)return;
 var state=readArmedProbe();
 if(!state)return;
 state.writingToolsSeen=cappedCount(state.writingToolsSeen);
 if(storeWrite(GROUP_PROBE_STATE,JSON.stringify(state)))
  log("SIRI_PROBE_WRITINGTOOLS_SEEN");
 else log("SIRI_PROBE_STORE_WRITE_FAILED");
}
function probeObserveRequest(){
 if(res)return;
 var state=readArmedProbe();
 if(!state)return;
 // Never record group IDs from non-POST traffic, even with a Siri-looking UA.
 if(String(req.method||req.httpMethod||"").toUpperCase()!=="POST"){
  log("SIRI_PROBE_NON_POST_IGNORED");return;
 }
 if(!isSiriForProbe()){
  state.otherClientSeen=cappedCount(state.otherClientSeen);
  if(storeWrite(GROUP_PROBE_STATE,JSON.stringify(state)))
   log("SIRI_PROBE_OTHER_CLIENT_SEEN");
  else log("SIRI_PROBE_STORE_WRITE_FAILED");
  return;
 }
 state.siriSeen=cappedCount(state.siriSeen);
 // Only these fixed parser codes may be recorded, never untrusted values.
 var fixed={
  OK:1,BODY_NOT_TEXT:1,BODY_EMPTY:1,BODY_OVERSIZE:1,
  JSON_INVALID:1,ROOT_UNSUPPORTED:1,GROUP_MISSING:1,
  GROUP_UNSUPPORTED:1,INPUT_UNSUPPORTED:1,CONTENT_UNSUPPORTED:1,
  MEDIA_UNSUPPORTED:1,PROMPT_EMPTY:1,PROMPT_OVERSIZE:1,
  STRUCTURE_UNSUPPORTED:1
 };
 state.lastCode=fixed[requestDiagnostic]?requestDiagnostic:"UNKNOWN_STAGE";
 var now=Date.now();
 if(requestDiagnostic==="GROUP_UNSUPPORTED"){
  if(safeGroupIdentifier(requestGroup)){
   state.phase="captured";
   state.groupId=requestGroup;
   // Keep the capture readable for ten minutes after the matching Siri request.
   state.expiresAt=now+GROUP_PROBE_WINDOW_MS;
   state.lastCode="GROUP_CAPTURED";
  }else state.lastCode="GROUP_ID_UNSAFE";
 }
 if(!storeWrite(GROUP_PROBE_STATE,JSON.stringify(state))){
  log("SIRI_PROBE_STORE_WRITE_FAILED");return;
 }
 if(state.phase==="captured")log("SIRI_GROUP_CAPTURED_LOCAL");
 else if(state.lastCode==="GROUP_ID_UNSAFE")log("SIRI_GROUP_PROBE_UNSAFE_ID");
 else log("SIRI_PROBE_SIRI_REQUEST_SEEN");
}
// The observed iPadOS 27.3 Siri group is named "multimodal". To prevent
// accidentally routing images, audio, sidecar attachments or hidden context to
// the text-only model, support only explicit text envelopes for this group.
// The real Siri JSON envelope remains unverified: reject unknown structures.
// Separate one-shot, opt-in *schema metadata* diagnostic for the real noRTI
// parser mismatch. NEVER store request values, text, IDs, headers or secrets.
// Key names are bounded and secret-looking names are redacted. All captured
// material remains in Shadowrocket's local persistent store until manual read.
var NORTI_SCHEMA_PROBE_STATE="AIES_NORTI_SCHEMA_PROBE_V1_STATE";
var NORTI_SCHEMA_PROBE_TTL=600000;
function safeSchemaFieldName(k){
 return typeof k==="string"&&k.length>0&&k.length<=40&&
  /^[A-Za-z_][A-Za-z0-9_-]*$/.test(k)&&
  !/[A-Za-z0-9]{22,}/.test(k)&&
  !/(?:secret|token|auth|bearer|cookie|passwd|password|private|credential|api.?key|session|account|user|email|phone|address|location|uuid|identifier)/i.test(k);
}
function schemaTypeName(v){
 if(v===null)return "null";
 if(Array.isArray(v))return "array";
 var t=typeof v;
 return t==="string"||t==="number"||t==="boolean"||t==="object"?t:"other";
}
function schemaKeysOnly(obj,excluded){
 if(!obj||typeof obj!=="object"||Array.isArray(obj))return [];
 var out=[],keys=Object.keys(obj);
 for(var i=0;i<keys.length;i++){
  var k=keys[i];
  if(excluded.indexOf(k)>=0)continue;
  if(out.length>=8){out.push({name:"TRUNCATED",type:"other"});break;}
  out.push({name:safeSchemaFieldName(k)?k:"REDACTED",type:schemaTypeName(obj[k])});
 }
 return out;
}
function captureNortiSchemaLocally(o){
 // This executes ONLY during a rejected Siri POST request hook, and only
 // after manual opt-in; never use response, WritingTools or other clients.
 if(res||!isSiriForProbe()||
    String(req.method||req.httpMethod||"").toUpperCase()!=="POST")return;
 var state=null,raw=storeRead(NORTI_SCHEMA_PROBE_STATE),now=Date.now();
 try{state=raw&&JSON.parse(raw);}catch(e){return;}
 if(!state||state.v!==1||state.phase!=="armed"||
    typeof state.createdAt!=="number"||typeof state.expiresAt!=="number"||
    !isFinite(state.createdAt)||!isFinite(state.expiresAt)||
    state.createdAt>now||state.expiresAt<=now||state.expiresAt>now+NORTI_SCHEMA_PROBE_TTL)return;
 var item=null,message=null,items=Array.isArray(o.input)?o.input:[];
 // Select first item with an extra message wrapper (if present), otherwise
 // first object item. Do not enumerate content objects or any values.
 for(var i=0;i<items.length&&i<12;i++){
  var candidate=items[i];
  if(!candidate||typeof candidate!=="object"||Array.isArray(candidate))continue;
  if(!item)item=candidate;
  if(Object.prototype.hasOwnProperty.call(candidate,"message")&&
     Object.keys(candidate).length>1){item=candidate;break;}
 }
 if(item&&item.message&&typeof item.message==="object"&&!Array.isArray(item.message))
  message=item.message;
 var result={
  v:1,phase:"captured",createdAt:state.createdAt,
  expiresAt:now+NORTI_SCHEMA_PROBE_TTL,
  inputType:schemaTypeName(o.input),
  root:schemaKeysOnly(o,["configuration","input"]),
  wrapper:schemaKeysOnly(item,["message","content"]),
  message:schemaKeysOnly(message,[])
 };
 if(storeWrite(NORTI_SCHEMA_PROBE_STATE,JSON.stringify(result)))
  log("NORTI_SCHEMA_CAPTURED_LOCAL");
 else log("NORTI_SCHEMA_STORE_FAILED");
}
function observedSiriTextEnvelopeReasons(o){
 // Report *only* fixed categories, never unknown field names or field values.
 // Check independent layers even after one failure, so a single Siri request
 // can distinguish multiple shape mismatches without exposing its JSON.
 var reasons=[],top=Object.keys(o);
 if(top.length!==2||top.indexOf("configuration")<0||top.indexOf("input")<0)
  reasons.push("ROOT_FIELDS");
 if(!Object.prototype.hasOwnProperty.call(o,"input")){
  reasons.push("INPUT_MISSING");return reasons;
 }
 if(!Array.isArray(o.input)){
  reasons.push("INPUT_NOT_ARRAY");return reasons;
 }
 if(o.input.length<1||o.input.length>12){
  reasons.push("INPUT_COUNT");return reasons;
 }
 for(var i=0;i<o.input.length;i++){
  var it=o.input[i];
  if(!it||typeof it!=="object"||Array.isArray(it)){
   reasons.push("ITEM_NOT_OBJECT");break;
  }
  var keys=Object.keys(it),nested=Object.prototype.hasOwnProperty.call(it,"message");
  if(nested){
   if(keys.length!==1||keys[0]!=="message"){
    reasons.push("ITEM_WRAPPER_FIELDS");break;
   }
   it=it.message;
   if(!it||typeof it!=="object"||Array.isArray(it)){
    reasons.push("MESSAGE_NOT_OBJECT");break;
   }
   keys=Object.keys(it);
  }
  if(!keys.length||keys.some(function(k){return k!=="content"&&k!=="role"&&k!=="type";})){
   reasons.push("ITEM_FIELDS");break;
  }
  if(!Object.prototype.hasOwnProperty.call(it,"content")){
   reasons.push("CONTENT_MISSING");break;
  }
  if(Object.prototype.hasOwnProperty.call(it,"role")&&it.role!=="user"){
   reasons.push("ROLE_UNSUPPORTED");break;
  }
  if(Object.prototype.hasOwnProperty.call(it,"type")&&it.type!=="message"){
   reasons.push("ITEM_TYPE_UNSUPPORTED");break;
  }
 }
 return reasons;
}
function parseRequest(raw){
 if(!raw){if(requestDiagnostic==="UNSET")requestDiagnostic="BODY_EMPTY";return null;}
 if(raw.length>C.maxRequest){requestDiagnostic="BODY_OVERSIZE";return null;}
 var o;
 try{o=JSON.parse(raw);}catch(e){requestDiagnostic="JSON_INVALID";return null;}
 if(!o||typeof o!=="object"||Array.isArray(o)){requestDiagnostic="ROOT_UNSUPPORTED";return null;}
 try{
  var g=o.configuration&&o.configuration.response_configuration_group_id;
  if(typeof g!=="string"){requestDiagnostic="GROUP_MISSING";return null;}
  requestGroup=g;
  var observedGroup=g==="siri.multimodal.noRTI";
  if(!/^(siri\.tqa|siri_tqa)$/i.test(g)&&!observedGroup){
   requestDiagnostic="GROUP_UNSUPPORTED";return null;
  }
  // The newly observed multimodal group is never accepted for WritingTools,
  // unknown clients or unverified non-text JSON envelopes.
  if(observedGroup&&!isSiriForProbe()){
   requestDiagnostic="GROUP_UNSUPPORTED";return null;
  }
  if(observedGroup){
   var shapeReasons=observedSiriTextEnvelopeReasons(o);
   if(shapeReasons.length){
    captureNortiSchemaLocally(o);
    shapeReasons.forEach(function(code){log("NORTI_SHAPE_"+code);});
    requestDiagnostic="INPUT_UNSUPPORTED";return null;
   }
  }
  if(!Array.isArray(o.input)||o.input.length<1||o.input.length>12){
   requestDiagnostic="INPUT_UNSUPPORTED";return null;
  }
  var parts=[];
  for(var i=0;i<o.input.length;i++){
   var it=o.input[i],m=it&&it.message&&typeof it.message==="object"?it.message:it;
   var content=m&&m.content;
   var list=Array.isArray(content)?content:[content];
   if(list.length<1||list.length>64){requestDiagnostic="CONTENT_UNSUPPORTED";return null;}
   for(var j=0;j<list.length;j++){
    var str=textAtom(list[j]);
    if(typeof str!=="string"){requestDiagnostic="CONTENT_UNSUPPORTED";return null;}
    if(/data:(image|audio|video)\//i.test(str)){requestDiagnostic="MEDIA_UNSUPPORTED";return null;}
    if(str.trim())parts.push(str.trim());
   }
  }
  var prompt=parts.join("\n\n");
  if(!prompt){requestDiagnostic="PROMPT_EMPTY";return null;}
  if(prompt.length>C.maxPrompt){requestDiagnostic="PROMPT_OVERSIZE";return null;}
  requestDiagnostic="OK";
  return prompt;
 }catch(e){requestDiagnostic="STRUCTURE_UNSUPPORTED";return null;}
}
function validKey(k){return typeof k==="string"&&/^[A-Za-z0-9_-]{12,256}$/.test(k)&&!/REPLACE_WITH|PLACEHOLDER/i.test(k);}
function statusCode(resp){
 var s=resp&&(resp.statusCode||resp.status)||0;
 return typeof s==="number"?s:Number((String(s).match(/\b\d{3}\b/)||[])[0]||0);
}
function modelReply(resp,body){
 if(statusCode(resp)!==200||typeof body!=="string"||body.length>900000)return null;
 try{
  var obj=JSON.parse(body),choice=obj.choices&&obj.choices[0];
  if(!choice||choice.finish_reason!=="stop")return null;
  var a=choice.message&&choice.message.content;
  if(typeof a!=="string"||!a.trim()||a.length>C.maxAnswer)return null;
  return a.trim();
 }catch(e){return null;}
}
function safeJson(v){return JSON.stringify(v);}
function event(name,data){
 var o={type:name};o[name]=data;
 return "event: "+name+"\ndata: "+safeJson(o)+"\n\n";
}
var E={
 session:"session.created",created:"session.response.created",
 choice:"session.response.choices[].added",
 item:"session.response.choices[].items[].added",
 added:"session.response.choices[].items[].message.content[].added",
 delta:"session.response.choices[].items[].message.content[].text.value.delta",
 textDone:"session.response.choices[].items[].message.content[].text.value.done",
 contentDone:"session.response.choices[].items[].message.content[].done",
 itemDone:"session.response.choices[].items[].done",
 completed:"session.response.choices[].completed",
 choiceDone:"session.response.choices[].done",
 responseDone:"session.response.done"
};
function validId(x){return typeof x==="string"&&/^[A-Za-z0-9_-]{1,160}$/.test(x);}
function rewriteSse(original,answer){
 // This parser intentionally rejects unknown SSE events rather than copy any
 // potentially answer-bearing Qwen text through to Siri.
 if(typeof original!=="string"||original.length>C.maxSse||!original.length)return null;
 var frames=original.replace(/\r\n/g,"\n").split("\n\n"),out=[],entries=[],i;
 for(i=0;i<frames.length;i++){
  var f=frames[i].trim();
  if(!f)continue;
  var lines=f.split("\n");
  if(lines.length!==2||lines[0].slice(0,7)!=="event: "||
     lines[1].slice(0,6)!=="data: ")return null;
  var name=lines[0].slice(7),obj;
  if(Object.keys(E).every(function(k){return E[k]!==name;}))return null;
  try{obj=JSON.parse(lines[1].slice(6));}catch(e){return null;}
  if(!obj||obj.type!==name||!Object.prototype.hasOwnProperty.call(obj,name))return null;
  entries.push({name:name,payload:obj[name]});
 }
 if(entries.length<12||entries.length>256)return null;
 // Require complete, known event progression and one or more deltas.
 var names=entries.map(function(x){return x.name;});
 var prefix=[E.session,E.created,E.choice,E.item,E.added];
 var suffix=[E.textDone,E.contentDone,E.itemDone,E.completed,E.choiceDone,E.responseDone];
 for(i=0;i<5;i++)if(names[i]!==prefix[i])return null;
 for(i=0;i<6;i++)if(names[names.length-6+i]!==suffix[i])return null;
 for(i=5;i<names.length-6;i++)if(names[i]!==E.delta)return null;
 if(names.length<12)return null;
 var s=entries[0].payload,r=entries[1].payload;
 if(!s||!r||!validId(s.id)||!validId(r.id)||r.session_id!==s.id||
    typeof s.expires_at!=="number"||!isFinite(s.expires_at)||
    s.expires_at<0||Math.floor(s.expires_at)!==s.expires_at)return null;
 var ids={s:s.id,r:r.id};
 // No Qwen answer strings or arbitrary keys are preserved. Recreate event
 // payloads from verified IDs + DeepSeek output only.
 var body=safeJson({content:answer,suggestions:[],summary:"DeepSeek"});
 var outputs=[{message:{content:[{text:{value:body}}]}}];
 var n=[
 {id:ids.s,object:"realtime.session",expires_at:s.expires_at},
 {id:ids.r,session_id:ids.s,model:"aies/deepseek",status:"in_progress"},
 {choice_index:0,choice:{index:0,status:"in_progress"}},
 {choice_index:0,item_index:0,item:{id:"item_aies_"+ids.r.slice(0,40),type:"message",message:{role:"assistant",content:[]}}},
 {choice_index:0,item_index:0,content_index:0,content:{type:"text",text:{value:""}}}
 ];
 for(i=5;i<names.length-6;i++)n.push({choice_index:0,item_index:0,content_index:0,delta:i===5?body:""});
 n.push(
 {choice_index:0,item_index:0,content_index:0,value:body},
 {choice_index:0,item_index:0,content_index:0,content:{type:"text",text:{value:body}}},
 {choice_index:0,item_index:0,item:{type:"message",message:{role:"assistant",content:[{type:"text",text:{value:body}}]}}},
 {choice_index:0,choice:{output:outputs}},
 {choice_index:0,choice:{output:outputs}},
 {id:ids.r,choices:[{output:outputs}]}
 );
 for(i=0;i<names.length;i++)out.push(event(names[i],n[i]));
 var joined=out.join("");
 if(joined.length>C.maxSse||joined.indexOf(answer)<0)return null;
 return joined;
}
function randomToken(){
 return "aies_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,14)+"_"+Math.random().toString(36).slice(2,14);
}
function storeWrite(key,val){try{return !!(store&&store.write&&store.write(val,key));}catch(e){return false;}}
function storeRead(key){try{return store&&store.read?store.read(key):null;}catch(e){return null;}}
function isTarget(){return !!(req&&typeof req.url==="string"&&C.target.test(req.url));}
if(!isTarget()){done({});return;}
// WritingTools uses this endpoint too, but is outside this Siri-only product.
if(isWritingTools()){probeObserveWritingTools();log("WRITINGTOOLS_SKIPPED");done({});return;}
if(!res){
 // Phase 1: capture a prompt and explicitly couple request/response using
 // an opaque ID. Unlike "latest prompt", concurrent requests never share a slot.
 var prompt=parseRequest(rawRequest());
 probeObserveRequest();
 if(!prompt){log("REQUEST_DIAG_"+requestDiagnostic);error("UNSUPPORTED_SIRI_REQUEST");return;}
 if(String(req.method||req.httpMethod||"").toUpperCase()!=="POST"){error("INVALID_METHOD");return;}
 var token=randomToken();
 if(!storeWrite("AIES_R1_"+token,safeJson({p:prompt,exp:Date.now()+C.sessionTtlMs}))){
  error("SESSION_STORE_UNAVAILABLE");return;
 }
 var headers={};Object.keys(req.headers||{}).forEach(function(k){
  if(k.toLowerCase()!=="x-aies-request-id")headers[k]=req.headers[k];
 });
 headers["X-AIES-Request-ID"]=token;
 log("REQUEST_CAPTURED");
 done({headers:headers});
 return;
}
// Phase 2: never return the raw Qwen body from code paths we control.
if(statusCode(res)!==200){error("ORIGINAL_RESPONSE_STATUS");return;}
if(!res||typeof res.body!=="string"||res.body.length>C.maxSse){error("SSE_UNAVAILABLE");return;}
var tag=header(req.headers,"X-AIES-Request-ID"),current=null,prompt2=null;
if(/^aies_[a-z0-9_]{12,90}$/.test(tag)){
 var raw=storeRead("AIES_R1_"+tag);
 try{current=raw&&JSON.parse(raw);}catch(e){}
 storeWrite("AIES_R1_"+tag,""); // consume once, even if invalid
 if(current&&current.exp>Date.now()&&current.exp<=Date.now()+C.sessionTtlMs&&
    typeof current.p==="string"&&current.p.length<=C.maxPrompt)prompt2=current.p;
}
var fromReq=parseRequest(rawRequest());
if(prompt2&&fromReq&&prompt2!==fromReq){error("CORRELATION_MISMATCH");return;}
if(!prompt2)prompt2=fromReq;
if(!prompt2){error("PROMPT_UNAVAILABLE");return;}
// Fail before billing DeepSeek if this upstream stream cannot be rewritten.
if(!rewriteSse(res.body,"AIES_VALIDATION_ONLY")){error("SSE_REWRITE_UNSUPPORTED");return;}
var key=storeRead(C.keyName);
if(!validKey(key)){error("KEY_NOT_PROVISIONED");return;}
if(!http||typeof http.post!=="function"){error("HTTP_CLIENT_UNAVAILABLE");return;}
if(typeof setTimeout==="function")timer=setTimeout(function(){error("MODEL_TIMEOUT");},C.timeoutMs);
log("DEEPSEEK_STARTED");
try{
 http.post({
  url:C.endpoint,method:"POST",timeout:10,"auto-redirect":false,
  headers:{"Content-Type":"application/json","Accept":"application/json","Authorization":"Bearer "+key},
  body:safeJson({
   model:C.model,stream:false,max_tokens:500,
   messages:[
    {role:"system",content:"你是简洁准确的中文 Siri 问答助手。只给出直接回答，避免寒暄与动作描写。"},
    {role:"user",content:prompt2}
   ]
  })
 },function(err,reply,bodyText){
  if(once)return;
  if(err){error("MODEL_NETWORK");return;}
  var answer=modelReply(reply,bodyText);
  if(!answer){error("MODEL_RESPONSE_INVALID");return;}
  var rewritten=rewriteSse(res.body,answer);
  if(!rewritten){error("SSE_REWRITE_UNSUPPORTED");return;}
  log("DEEPSEEK_RESPONSE_ATTEMPTED");
  done({status:200,headers:{"Content-Type":"text/event-stream; charset=utf-8","Cache-Control":"no-store","X-AIES-Answer-Source":"deepseek"},body:rewritten});
 });
}catch(e){error("MODEL_EXCEPTION");}
})();