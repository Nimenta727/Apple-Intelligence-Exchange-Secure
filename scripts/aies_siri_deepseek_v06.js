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
  // Real Siri also used session-scoped response URLs, absent from old Hook.
  followup:/^https:\/\/prod-yabuli\.qianwen\.com\/v1\/sessions\/[^\/?#]{1,160}\/responses(?:\?[^#]*)?$/i,
  endpoint:"https://api.deepseek.com/chat/completions",
  model:"deepseek-flash",
  keyName:"SAIRS_DEEPSEEK_API_KEY",
  maxRequest:300000,maxPrompt:14000,maxSse:900000,maxAnswer:12000,
  timeoutMs:15000,sessionTtlMs:45000
};
// Only add this human-visible source label to successfully validated DeepSeek
// replies. Siri/Qwen service branding is controlled upstream and may not change.
var DEEPSEEK_SOURCE_LABEL="【DeepSeek · AIES】";
var req=typeof $request!=="undefined" ? $request : null;
var res=typeof $response!=="undefined" ? $response : null;
var store=typeof $persistentStore!=="undefined" ? $persistentStore : null;
var http=typeof $httpClient!=="undefined" ? $httpClient : null;
var finish=typeof $done==="function" ? $done : null;
if(!finish)return;
var once=false,timer=null;
function log(s){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_V06] "+s);}catch(e){};abStatus(s);}
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
// ONE-SHOT LOCAL, OPT-IN capture of the actual Siri->Qwen JSON request body.
// The capture is redacted BEFORE persistence: preserves message text/shape,
// never reads credentials/header values or forwards data to another server.
// Does not change request/response behavior: unsupported requests still fail.
var QWEN_BODY_PROBE_STATE="AIES_QWEN_BODY_PROBE_V1_STATE";
var QWEN_BODY_PROBE_WINDOW_MS=600000;
function qwenBodyType(v){
 if(v===null)return "null";
 if(Array.isArray(v))return "array";
 return typeof v;
}
function qwenBodyRedactString(s){
 return s.replace(/\b(?:sk-[A-Za-z0-9_-]{8,}|Bearer\s+[A-Za-z0-9_.-]{8,}|eyJ[A-Za-z0-9_-]{20,}(?:\.[A-Za-z0-9_-]+){1,2})\b/g,"[REDACTED_TOKEN]")
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig,"[REDACTED_EMAIL]");
}
function qwenBodyScrub(v,key,depth,counts){
 counts.nodes++;
 if(counts.nodes>180)return "[NODE_LIMIT]";
 if(depth>7)return "[DEPTH_LIMIT]";
 if(/(?:authorization|auth|token|cookie|password|secret|api.?key|session|credential|private|signature|phone|email|address|location|device|account|uuid|identifier|bearer)/i.test(key)&&
    key!=="response_configuration_group_id")return "[REDACTED_FIELD]";
 if(/(?:image|audio|video|attachment|media|base64|blob|file|binary|data_url)/i.test(key))
  return "[REDACTED_MEDIA]";
 if(key==="input_hint")return "[REDACTED_CONTEXT]";
 if(v===null||typeof v==="number"||typeof v==="boolean")return v;
 if(typeof v==="string"){
  if(v.length>2000)return "[LONG_TEXT_REDACTED]";
  if(/^(?:https?:\/\/|data:|file:)/i.test(v))return "[REDACTED_URI]";
  return qwenBodyRedactString(v);
 }
 if(Array.isArray(v)){
  if(v.length>20)return "[ARRAY_COUNT_EXCEEDED]";
  return v.map(function(x){return qwenBodyScrub(x,key,depth+1,counts);});
 }
 if(typeof v!=="object")return "[UNKNOWN_TYPE]";
 var out={},keys=Object.keys(v);
 if(keys.length>28)return "[OBJECT_FIELDS_EXCEEDED]";
 for(var i=0;i<keys.length;i++){
  var k=keys[i];
  if(k.length>80){out["[LONG_FIELD_NAME]"]="[REDACTED]";continue;}
  out[k]=qwenBodyScrub(v[k],k,depth+1,counts);
 }
 return out;
}
function captureQwenRequestBodyOnce(){
 if(res||!isSiriForProbe()||!req||
    String(req.method||req.httpMethod||"").toUpperCase()!=="POST")return;
 var raw=storeRead(QWEN_BODY_PROBE_STATE),st=null,now=Date.now();
 if(!raw)return;
 try{st=JSON.parse(raw);}catch(e){return;}
 if(!st||st.v!==1||st.phase!=="armed"||
    typeof st.createdAt!=="number"||typeof st.expiresAt!=="number"||
    st.createdAt>now||st.expiresAt<=now||st.expiresAt>now+QWEN_BODY_PROBE_WINDOW_MS)return;
 if(typeof req.body!=="string"||!req.body.length||req.body.length>40000){
  log("QWEN_BODY_CAPTURE_BODY_UNAVAILABLE");return;
 }
 var parsed=null;
 try{parsed=JSON.parse(req.body);}catch(e){log("QWEN_BODY_CAPTURE_JSON_INVALID");return;}
 if(!parsed||typeof parsed!=="object"||Array.isArray(parsed)){
  log("QWEN_BODY_CAPTURE_ROOT_UNSUPPORTED");return;
 }
 var clean={},ks=Object.keys(parsed),counts={nodes:0};
 // Input text and JSON envelope retained; tool definitions and format options
 // contribute only type/count descriptors, never their private contents.
 for(var i=0;i<ks.length;i++){
  var key=ks[i],val=parsed[key];
  if(["configuration","input","input_hint","stream"].indexOf(key)<0)
   clean[key]={omitted:true,type:qwenBodyType(val),
    count:Array.isArray(val)?Math.min(val.length,99):undefined};
  else clean[key]=qwenBodyScrub(val,key,0,counts);
 }
 var snapshot=JSON.stringify(clean);
 if(snapshot.length>18000){
  log("QWEN_BODY_CAPTURE_SANITIZED_TOO_LARGE");return;
 }
 var captured={v:1,phase:"captured",createdAt:st.createdAt,
  expiresAt:now+QWEN_BODY_PROBE_WINDOW_MS,body:snapshot};
 if(storeWrite(QWEN_BODY_PROBE_STATE,JSON.stringify(captured)))
  log("QWEN_BODY_CAPTURED_LOCAL");
 else log("QWEN_BODY_CAPTURE_STORE_FAILED");
}
function observedSiriTextEnvelopeReasons(o){
 // Exact field names and field TYPES confirmed by the local iPad schema probe.
 // Root metadata is not forwarded to DeepSeek. Unknown keys, tool calls, media
 // and unsupported message types remain blocked by this and textAtom().
 var reasons=[],top=Object.keys(o);
 var allowedRoot=["configuration","input","client_tools","input_hint","response_format","server_tools","stream"];
 if(top.some(function(k){return allowedRoot.indexOf(k)<0;})||
    top.indexOf("configuration")<0||top.indexOf("input")<0)
  reasons.push("ROOT_FIELDS");
 if((Object.prototype.hasOwnProperty.call(o,"client_tools")&&!Array.isArray(o.client_tools))||
    (Object.prototype.hasOwnProperty.call(o,"server_tools")&&!Array.isArray(o.server_tools))||
    (Object.prototype.hasOwnProperty.call(o,"response_format")&&
      (!o.response_format||typeof o.response_format!=="object"||Array.isArray(o.response_format)))||
    (Object.prototype.hasOwnProperty.call(o,"stream")&&typeof o.stream!=="boolean")||
    (Object.prototype.hasOwnProperty.call(o,"input_hint")&&typeof o.input_hint!=="string"))
  reasons.push("ROOT_FIELD_TYPES");
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
   // Real Siri's wrapper contains "message" and "type"; require the
   // documented text-message discriminator. Never accept tool-call types.
   if(keys.some(function(k){return k!=="message"&&k!=="type";})){
    reasons.push("ITEM_WRAPPER_FIELDS");break;
   }
   if(Object.prototype.hasOwnProperty.call(it,"type")&&it.type!=="message"){
    reasons.push("WRAPPER_TYPE_UNSUPPORTED");break;
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
   if(m&&typeof m==="object"&&Object.prototype.hasOwnProperty.call(m,"role")&&m.role!=="user"){
    requestDiagnostic="INPUT_UNSUPPORTED";return null;
   }
   if(it&&typeof it==="object"&&Object.prototype.hasOwnProperty.call(it,"type")&&it.type!=="message"){
    requestDiagnostic="INPUT_UNSUPPORTED";return null;
   }
   var content=m&&m.content;
   var list=Array.isArray(content)?content:[content];
   if(list.length<1||list.length>64){requestDiagnostic="CONTENT_UNSUPPORTED";return null;}
   for(var j=0;j<list.length;j++){
    var str=textAtom(list[j]);
    if(typeof str!=="string"){
     // Never echo unknown content values or type discriminators to logs.
     // The observed group contains a content array, but element kinds are
     // not yet known; classify only the *structural* mismatch.
     if(observedGroup){
      var atom=list[j];
      var kind=!atom||typeof atom!=="object"?"PRIMITIVE_UNSUPPORTED":
       Array.isArray(atom)?"NESTED_ARRAY_UNSUPPORTED":
       "TEXT_OBJECT_UNSUPPORTED";
      log("NORTI_CONTENT_"+kind);
     }
     requestDiagnostic="CONTENT_UNSUPPORTED";return null;
    }
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
// Compose is documented by boitar/sair's iOS 27.3 Qwen reverse analysis.
// Exact allowlist: other WritingTools modes and rich/media input are NOT proven.
function parseWritingToolsRequest(raw){
 if(!isWritingTools()){requestDiagnostic="WRITING_CLIENT_UNSUPPORTED";return null;}
 if(!raw||raw.length>C.maxRequest){requestDiagnostic="WRITING_BODY_UNAVAILABLE";return null;}
 var o;
 try{o=JSON.parse(raw);}catch(e){requestDiagnostic="WRITING_JSON_INVALID";return null;}
 if(!o||typeof o!=="object"||Array.isArray(o)){
  requestDiagnostic="WRITING_ROOT_UNSUPPORTED";return null;
 }
 var g=o.configuration&&o.configuration.response_configuration_group_id;
 if(g!=="compose_selectedAndAllText"){
  requestDiagnostic="WRITING_GROUP_UNVERIFIED";return null;
 }
 if(o.stream!==true||!Array.isArray(o.input)||o.input.length<1||o.input.length>12){
  requestDiagnostic="WRITING_INPUT_UNSUPPORTED";return null;
 }
 if(Object.keys(o).some(function(k){
  return ["configuration","input","client_tools","server_tools","stream",
   "response_format","input_hint"].indexOf(k)<0;
 })){requestDiagnostic="WRITING_ROOT_UNSUPPORTED";return null;}
 if((o.client_tools&&!Array.isArray(o.client_tools))||
    (o.server_tools&&!Array.isArray(o.server_tools))){
  requestDiagnostic="WRITING_TOOLS_UNSUPPORTED";return null;
 }
 var parts=[];
 for(var i=0;i<o.input.length;i++){
  var item=o.input[i];
  if(!item||typeof item!=="object"||Array.isArray(item)||
     (item.type&&item.type!=="message")){
   requestDiagnostic="WRITING_INPUT_UNSUPPORTED";return null;
  }
  var m=item.message&&typeof item.message==="object"?item.message:item;
  if(m.role!=="user"){requestDiagnostic="WRITING_ROLE_UNSUPPORTED";return null;}
  var content=m.content,atoms=Array.isArray(content)?content:[content];
  if(atoms.length<1||atoms.length>32){requestDiagnostic="WRITING_CONTENT_UNSUPPORTED";return null;}
  for(var j=0;j<atoms.length;j++){
   var txt=textAtom(atoms[j]);
   if(typeof txt!=="string"||/data:(?:image|audio|video)\//i.test(txt)){
    requestDiagnostic="WRITING_MEDIA_OR_CONTENT_UNSUPPORTED";return null;
   }
   if(txt.trim())parts.push(txt.trim());
  }
 }
 var prompt=parts.join("\n\n");
 if(!prompt||prompt.length>C.maxPrompt){
  requestDiagnostic="WRITING_PROMPT_UNSUPPORTED";return null;
 }
 requestDiagnostic="OK";return prompt;
}
function parseApplePrompt(raw){
 return isWritingTools()?parseWritingToolsRequest(raw):parseRequest(raw);
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
function verifiedDeepSeekAnswerWithLabel(answer){
 // Never infer provenance from Siri UI. This function is called exclusively
 // after modelReply has verified a successful DeepSeek API completion.
 if(typeof answer!=="string"||!answer.trim())return null;
 var plain=answer.trim();
 // Code-enforced provenance (not prompt-dependent), exactly once at start.
 while(plain.indexOf(DEEPSEEK_SOURCE_LABEL)===0)plain=plain.slice(DEEPSEEK_SOURCE_LABEL.length).trim();
 if(!plain)return null;
 var result=DEEPSEEK_SOURCE_LABEL+"\n"+plain;
 return result.length<=C.maxAnswer?result:null;
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
 // Complex Siri/Qwen text can have citation annotations AFTER text.value.done.
 annotation:"session.response.choices[].items[].message.content[].text.annotations[].added",
 contentDone:"session.response.choices[].items[].message.content[].done",
 itemDone:"session.response.choices[].items[].done",
 completed:"session.response.choices[].completed",
 choiceDone:"session.response.choices[].done",
 responseDone:"session.response.done"
};
function validId(x){return typeof x==="string"&&/^[A-Za-z0-9_-]{1,160}$/.test(x);}
// Reconstruct the real observed Qwen SSE *field layout*, not its text.
// Only IDs and carefully validated transport metadata are read from Qwen.
// All answer-bearing fields and output items are created from DeepSeek text.
function validEpoch(v){return typeof v==="number"&&isFinite(v)&&v>=0&&v<=9999999999999&&Math.floor(v)===v;}
function epochOr(v,fallback){return validEpoch(v)?v:fallback;}
function safeObjectName(v,fallback){
 return typeof v==="string"&&/^[a-z][a-z0-9_.-]{0,60}$/.test(v)?v:fallback;
}
function safeContinueUrl(v){
 // The URL goes only back to the same Siri client, never to DeepSeek.
 // Restrict it to the original Qwen origin to prevent unexpected endpoints.
 return typeof v==="string"&&v.length<=1200&&
  (v===""||/^https:\/\/prod-yabuli\.qianwen\.com(?:\/|$)/i.test(v))?v:"";
}
function emptyOrMissing(v){return typeof v==="undefined"||(Array.isArray(v)&&v.length===0);}
function rewriteSse(original,answer,scene){
 if(scene!=="writing")scene="siri";
 // Exact event sequence known from native Siri/Qwen. Unknown frames or tool
 // variants fail CLOSED. Never copy a full original SSE payload.
 if(typeof original!=="string"||original.length>C.maxSse||!original.length||
    typeof answer!=="string"||!answer.trim())return null;
 // Tolerate normal SSE framing (CR/LF, comment, id/retry fields,
 // multiline data and field order) but keep known event names and order.
 // Never copy original Qwen answer-bearing payloads into the output.
 var frames=original.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n\n"),entries=[],i;
 for(i=0;i<frames.length;i++){
  var f=frames[i].trim();if(!f)continue;
  var lines=f.split("\n"),name="",data=[],j;
  for(j=0;j<lines.length;j++){
   var line=lines[j],colon=line.indexOf(":"),field=colon<0?line:line.slice(0,colon);
   if(line.charAt(0)===":"||!line.trim())continue;
   var value=colon<0?"":line.slice(colon+1).replace(/^ /,"");
   if(field==="event"){if(name)return null;name=value;}
   else if(field==="data"){data.push(value);if(data.length>16)return null;}
   else if(field!=="id"&&field!=="retry")return null;
  }
  if(!name||!data.length||
     Object.keys(E).every(function(k){return E[k]!==name;}))return null;
  var obj;
  try{obj=JSON.parse(data.join("\n"));}catch(e){return null;}
  if(!obj||obj.type!==name||!Object.prototype.hasOwnProperty.call(obj,name))return null;
  entries.push({name:name,payload:obj[name]});
 }
 // Citation annotations are observed only between text.value.done and
 // content.done. Never copy their source URLs, IDs, snippets or other Qwen
 // content into a synthetic DeepSeek reply. Preserve only the text event
 // skeleton, and fail closed for annotations outside this verified interval.
 if(entries.length<12||entries.length>256)return null;
 var clean=[],seenTextDone=false,seenContentDone=false,annotationCount=0;
 for(i=0;i<entries.length;i++){
  var row=entries[i];
  if(row.name===E.annotation){
   if(!seenTextDone||seenContentDone||++annotationCount>64||
      !row.payload||typeof row.payload!=="object"||
      Array.isArray(row.payload))return null;
   // Annotation data is explicitly discarded: not copied, sent or logged.
   continue;
  }
  if(row.name===E.textDone){
   if(seenTextDone)return null;
   seenTextDone=true;
  }
  if(row.name===E.contentDone)seenContentDone=true;
  clean.push(row);
 }
 entries=clean;
 if(entries.length<12||entries.length>256)return null;
 var names=entries.map(function(x){return x.name;});
 var prefix=[E.session,E.created,E.choice,E.item,E.added];
 var suffix=[E.textDone,E.contentDone,E.itemDone,E.completed,E.choiceDone,E.responseDone];
 for(i=0;i<5;i++)if(names[i]!==prefix[i])return null;
 for(i=0;i<6;i++)if(names[names.length-6+i]!==suffix[i])return null;
 for(i=5;i<names.length-6;i++)if(names[i]!==E.delta)return null;
 var s=entries[0].payload,r=entries[1].payload;
 if(!s||!r||!validId(s.id)||!validId(r.id)||r.session_id!==s.id||
    !validEpoch(s.expires_at))return null;
 // Modality / safety: never synthesize an answer for active tool executions,
 // notices, moderation decisions or unexpected non-message output.
 var choiceAdded=entries[2].payload&&entries[2].payload.choice;
 var itemAdded=entries[3].payload&&entries[3].payload.item;
 var choiceCompleted=entries[entries.length-3].payload&&entries[entries.length-3].payload.choice;
 var choiceDone=entries[entries.length-2].payload&&entries[entries.length-2].payload.choice;
 var lastResponse=entries[entries.length-1].payload;
 var lastChoice=lastResponse&&Array.isArray(lastResponse.choices)&&lastResponse.choices[0];
 if(!emptyOrMissing(r.notices)||!emptyOrMissing(lastResponse&&lastResponse.notices)||
    !emptyOrMissing(choiceCompleted&&choiceCompleted.moderation)||
    !emptyOrMissing(choiceDone&&choiceDone.moderation)||
    !emptyOrMissing(lastChoice&&lastChoice.moderation))return null;
 function isUnsupportedItem(item){
  if(!item||typeof item!=="object"||Array.isArray(item)||
     item.type&&item.type!=="message"||
     item.message&&item.message.role&&item.message.role!=="assistant")return true;
  var contents=item.message&&item.message.content;
  if(typeof contents!=="undefined"&&!Array.isArray(contents))return true;
  if(Array.isArray(contents)){
   for(var j=0;j<contents.length;j++){
    var entry=contents[j];
    if(!entry||typeof entry!=="object"||Array.isArray(entry)||
       entry.type&&entry.type!=="text"||
       // Upstream citation arrays may be present in completed text; none of
       // their contents are forwarded, and their length is bounded.
       entry.text&&typeof entry.text==="object"&&
       Object.prototype.hasOwnProperty.call(entry.text,"annotations")&&
       (!Array.isArray(entry.text.annotations)||entry.text.annotations.length>64))
     return true;
   }
  }
  return false;
 }
 function hasToolOutput(choice){
  if(!choice||!Array.isArray(choice.output))return false;
  for(var k=0;k<choice.output.length;k++)
   if(isUnsupportedItem(choice.output[k]))return true;
  return false;
 }
 var itemDone=entries[entries.length-4].payload&&entries[entries.length-4].payload.item;
 var contentAdded=entries[4].payload&&entries[4].payload.content;
 var contentDone=entries[entries.length-5].payload&&entries[entries.length-5].payload.content;
 if(hasToolOutput(choiceCompleted)||hasToolOutput(choiceDone)||hasToolOutput(lastChoice)||
    choiceAdded&&!emptyOrMissing(choiceAdded.output)||
    itemDone&&isUnsupportedItem(itemDone)||
    contentAdded&&contentAdded.type&&contentAdded.type!=="text"||
    contentDone&&contentDone.type&&contentDone.type!=="text")return null;
 if(itemAdded&&itemAdded.type&&itemAdded.type!=="message")return null;
 if(itemAdded&&itemAdded.message&&itemAdded.message.role&&
    itemAdded.message.role!=="assistant")return null;
 if(itemAdded&&itemAdded.message&&!emptyOrMissing(itemAdded.message.content))
  return null;
 // Do not copy model text from any source field; keep only bounded identity
 // metadata that Siri already received from its own Qwen backend.
 var now=Math.floor(Date.now()/1000);
 var created=epochOr(s.created_at,now);
 var lastActive=epochOr(s.last_active_at,created);
 var responseCreated=epochOr(r.created_at,created);
 var expireAfter=s.expires_after;
 var seconds=expireAfter&&validEpoch(expireAfter.seconds)&&expireAfter.seconds<=86400?
   expireAfter.seconds:120;
 var anchor=expireAfter&&(expireAfter.anchor==="last_active_at"||
   expireAfter.anchor==="created_at")?expireAfter.anchor:"created_at";
 var sid=s.id,rid=r.id;
 var choiceId=choiceAdded&&validId(choiceAdded.id)?choiceAdded.id:
   "choice_aies_"+rid.slice(0,80);
 var continuation=safeContinueUrl(choiceAdded&&choiceAdded.continue_url);
 var content=scene==="writing"?
  safeJson({body:answer,refinements:["精炼表达","调整语气","优化结构"]}):
  safeJson({content:answer,suggestions:[],summary:"【DeepSeek · AIES】"});
 var textContent={type:"text",text:{annotations:[],value:content}};
 var outputItem={type:"message",message:{role:"assistant",content:[textContent]}};
 var choiceOpen={output:[],id:choiceId,continue_url:continuation,status:"in_progress"};
 var choiceClosed={output:[outputItem],moderation:[],id:choiceId,
  continue_url:continuation,status:"completed"};
 var start=[
  {expires_at:s.expires_at,expires_after:{seconds:seconds,anchor:anchor},
   last_active_at:lastActive,created_at:created,id:sid,
   object:safeObjectName(s.object,"realtime.session")},
  {notices:[],session_id:sid,created_at:responseCreated,
   model:"aies/deepseek",id:rid,choices:[],
   object:safeObjectName(r.object,"realtime.response")},
  {index:0,choice:choiceOpen},
  {choice_index:0,item:{type:"message",message:{role:"assistant",content:[]}},index:0},
  {item_index:0,choice_index:0,index:0,
   content:{text:{annotations:[],value:""},type:"text"}}
 ];
 var out=[],n=start.slice();
 for(i=5;i<names.length-6;i++)
  n.push({item_index:0,choice_index:0,content_index:0,delta:i===5?content:""});
 n.push(
  {item_index:0,choice_index:0,content_index:0,value:content},
  {item_index:0,choice_index:0,index:0,content:textContent},
  {choice_index:0,item:outputItem,index:0},
  {index:0,choice:choiceClosed},
  {index:0,choice:choiceClosed},
  {notices:[],session_id:sid,created_at:responseCreated,model:"aies/deepseek",
   id:rid,choices:[choiceClosed],object:safeObjectName(r.object,"realtime.response")}
 );
 if(n.length!==names.length)return null;
 for(i=0;i<names.length;i++)out.push(event(names[i],n[i]));
 var joined=out.join("");
 if(joined.length>C.maxSse||joined.indexOf(safeJson(content))<0)return null;
 return joined;
}
// Manually armed, ten-minute DeepSeek-side A/B trace. This is OFF by default.
// Only one controlled nonsensitive Siri question should be asked per trace.
// The trace is local only; never copy credentials, HTTP headers, Siri prompts,
// session IDs or original Qwen text into the persistent snapshot or console.
var AB_TRACE_STATE="AIES_AB_DEEPSEEK_V1_STATE",AB_TRACE_WINDOW=600000;
function abState(){
 var raw=storeRead(AB_TRACE_STATE),st=null,now=Date.now();
 try{st=raw&&JSON.parse(raw);}catch(e){return null;}
 if(!st||st.v!==1||st.phase!=="armed"||!Array.isArray(st.events)||
    typeof st.createdAt!=="number"||typeof st.expiresAt!=="number"||
    st.createdAt>now||st.expiresAt<=now||
    st.expiresAt>now+AB_TRACE_WINDOW)return null;
 return st;
}
function abRecord(kind,detail){
 var st=abState();if(!st||st.events.length>=72)return;
 var line={tMs:Math.max(0,Date.now()-st.createdAt),stage:kind};
 if(detail&&typeof detail==="object"){
  var allowed=["code","route","method","group","promptChars","inputItems",
   "rootFields","requestType","status","bodyChars","eventCount","eventNames",
   "deltaCount","deltaChars","doneChars","unparsedFrames","reason",
   "choiceCount","finishReason","outputChars","answerText","answerTruncated",
   "reasoningType","reasoningChars","usage","rewrittenChars","markerPresent"];
  for(var i=0;i<allowed.length;i++){
   var key=allowed[i];
   if(Object.prototype.hasOwnProperty.call(detail,key))line[key]=detail[key];
  }
 }
 st.events.push(line);
 var packed=JSON.stringify(st);
 if(packed.length<=45000)storeWrite(AB_TRACE_STATE,packed);
}
function abText(text){
 // This MAY include the nonsensitive example answer the user explicitly asks
 // to compare. Keep it LOCAL until manual read; no reasoning traces or tokens.
 var clean=typeof text==="string"?text:"";
 clean=clean.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g,"[REDACTED_KEY]")
  .replace(/\bBearer\s+[A-Za-z0-9._-]{8,}\b/ig,"[REDACTED_AUTH]")
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig,"[REDACTED_EMAIL]")
  .replace(/https?:\/\/[^\s"'<>]+/ig,"[REDACTED_URL]");
 return {answerText:clean.slice(0,7000),answerTruncated:clean.length>7000};
}
function abStatus(code){
 if(typeof code==="string"&&/^[A-Z0-9_]{3,90}$/.test(code))
  abRecord("CODE",{code:code});
}
function abRequest(raw,prompt){
 var record={route:"MAIN",method:String(req&&req.method||"").toUpperCase()==="POST"?"POST":"OTHER",
  promptChars:typeof prompt==="string"?prompt.length:0};
 if(typeof raw!=="string"||raw.length>300000){
  record.requestType="UNAVAILABLE";abRecord("SIRI_REQUEST",record);return;
 }
 try{
  var o=JSON.parse(raw),c=o&&o.configuration,g=c&&c.response_configuration_group_id;
  record.group=g==="siri.multimodal.noRTI"?"siri.multimodal.noRTI":
   g==="compose_selectedAndAllText"?"compose_selectedAndAllText":
   (/^siri[._]tqa$/.test(g)?"siri.tqa":"OTHER_OR_MISSING");
  record.inputItems=Array.isArray(o.input)?Math.min(o.input.length,99):0;
  record.rootFields=Object.keys(o).filter(function(k){
   return ["configuration","input","client_tools","server_tools","response_format","stream","input_hint"].indexOf(k)>=0;
  }).sort();
  record.requestType="JSON_OBJECT";
 }catch(e){record.requestType="JSON_INVALID";}
 abRecord("SIRI_REQUEST",record);
}
function abSse(route,status,body){
 var info={route:route,status:typeof status==="number"?status:0,
  bodyChars:typeof body==="string"?body.length:0,
  eventCount:0,eventNames:[],deltaCount:0,deltaChars:0,doneChars:0,unparsedFrames:0};
 if(typeof body==="string"&&body.length<=900000){
  var blocks=body.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n\n");
  for(var i=0;i<blocks.length&&i<400;i++){
   var lines=blocks[i].split("\n"),name="",data=[];
   for(var j=0;j<lines.length;j++){
    var x=lines[j],pos=x.indexOf(":");
    if(x.slice(0,6)==="event:")name=x.slice(6).trim();
    if(x.slice(0,5)==="data:")data.push(x.slice(5).replace(/^ /,""));
   }
   if(!name)continue;
   var label=/^session(?:\.|$)/.test(name)&&
    /^[a-zA-Z0-9_.\[\]-]{1,110}$/.test(name)?name:"UNKNOWN_EVENT";
   info.eventCount++;
   if(info.eventNames.length<24)info.eventNames.push(label);
   try{
    var obj=JSON.parse(data.join("\n")),event=obj[name];
    if(/\.delta$/.test(name)){
     info.deltaCount++;
     if(event&&typeof event.delta==="string")info.deltaChars+=event.delta.length;
    }
    if(/text\.value\.done$/.test(name)&&event&&typeof event.value==="string")
     info.doneChars+=event.value.length;
   }catch(e){info.unparsedFrames++;}
  }
 }
 abRecord("SSE_STRUCTURE",info);
}
function abModel(reply,body,err){
 var info={status:statusCode(reply),bodyChars:typeof body==="string"?body.length:0,
  reason:err?"NETWORK_ERROR":"NONE"};
 if(typeof body==="string"&&body.length<=900000){
  try{
   var obj=JSON.parse(body),choice=Array.isArray(obj.choices)?obj.choices[0]:null;
   var m=choice&&choice.message;
   var txt=m&&m.content;
   info.choiceCount=Array.isArray(obj.choices)?obj.choices.length:0;
   info.finishReason=choice&&typeof choice.finish_reason==="string"&&
     /^(stop|length|content_filter|tool_calls)$/.test(choice.finish_reason)?
     choice.finish_reason:"OTHER_OR_MISSING";
   info.outputChars=typeof txt==="string"?txt.length:0;
   info.reasoningType=m&&typeof m.reasoning_content==="string"?"string":
     m&&m.reasoning_content===null?"null":"missing_or_other";
   info.reasoningChars=m&&typeof m.reasoning_content==="string"?m.reasoning_content.length:0;
   var u=obj.usage;
   if(u&&typeof u==="object"){
    info.usage={};
    ["prompt_tokens","completion_tokens","total_tokens"].forEach(function(k){
     if(typeof u[k]==="number"&&isFinite(u[k])&&u[k]>=0&&u[k]<10000000)
      info.usage[k]=Math.floor(u[k]);
    });
   }
   if(typeof txt==="string"){
    var preview=abText(txt);
    info.answerText=preview.answerText;info.answerTruncated=preview.answerTruncated;
   }
  }catch(e){info.reason="BODY_NOT_JSON";}
 }
 abRecord("DEEPSEEK_API",info);
}

function randomToken(){
 return "aies_"+Date.now().toString(36)+"_"+Math.random().toString(36).slice(2,14)+"_"+Math.random().toString(36).slice(2,14);
}
function storeWrite(key,val){try{return !!(store&&store.write&&store.write(val,key));}catch(e){return false;}}
function storeRead(key){try{return store&&store.read?store.read(key):null;}catch(e){return null;}}
function isTarget(){return !!(req&&typeof req.url==="string"&&C.target.test(req.url));}
function isFollowup(){return !!(req&&typeof req.url==="string"&&C.followup.test(req.url));}
function isFollowupTextSse(){
 if(!res||statusCode(res)!==200)return false;
 var ct=header(res.headers,"Content-Type");
 if(/(?:^|[;,\s])text\/event-stream(?:[;,\s]|$)/i.test(ct))return true;
 // A bounded protocol prefix check when upstream Content-Type is unavailable.
 // Never log/store response body or opaque session identifiers.
 return typeof res.body==="string"&&
  /(?:^|\n)event:\s*session\.response\./.test(res.body.slice(0,65536));
}
if(!isTarget()&&!isFollowup()){done({});return;}
// Apple WritingTools Compose and Siri have distinct return schemas.
// Only exact SAIR-observed Compose is opted into the experimental adapter.
if(isWritingTools()){probeObserveWritingTools();log("WRITINGTOOLS_COMPOSE_SCOPED");}
// Light native-Qwen leak guard: extra session-scoped URL observed in the user
// device proxy DB. Unlike the base request, we cannot safely rewrite these
// responses with DeepSeek without confirmed same-transaction correlation.
// Block only Siri HTTP-200 SSE responses on this specific path, not requests,
// non-SSE metadata, other clients or the whole Qwen domain.
if(isFollowup()){
 if(res&&isSiriForProbe()&&isFollowupTextSse()){
  abSse("SESSION_FOLLOWUP_BLOCKED",statusCode(res),res.body);
  log("QWEN_SESSION_FOLLOWUP_SSE_BLOCKED");
  error("QWEN_FOLLOWUP_UNVERIFIED_SOURCE");
 }else{
  if(res&&isSiriForProbe())log("QWEN_SESSION_FOLLOWUP_NON_SSE_SKIPPED");
  done({});
 }
 return;
}
if(!res){
 // Phase 1: capture a prompt and explicitly couple request/response using
 // an opaque ID. Unlike "latest prompt", concurrent requests never share a slot.
 captureQwenRequestBodyOnce();
 var prompt=parseApplePrompt(rawRequest());
 abRequest(rawRequest(),prompt);
 probeObserveRequest();
 if(!prompt){log("REQUEST_DIAG_"+requestDiagnostic);error(isWritingTools()?"UNSUPPORTED_WRITING_REQUEST":"UNSUPPORTED_SIRI_REQUEST");return;}
 if(String(req.method||req.httpMethod||"").toUpperCase()!=="POST"){error("INVALID_METHOD");return;}
 var token=randomToken();
 if(!storeWrite("AIES_R1_"+token,safeJson({p:prompt,scene:isWritingTools()?"writing":"siri",exp:Date.now()+C.sessionTtlMs}))){
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
abSse("MAIN_UPSTREAM",statusCode(res),res&&res.body);
if(statusCode(res)!==200){error("ORIGINAL_RESPONSE_STATUS");return;}
if(!res||typeof res.body!=="string"||res.body.length>C.maxSse){error("SSE_UNAVAILABLE");return;}
var tag=header(req.headers,"X-AIES-Request-ID"),current=null,prompt2=null;
var activeScene=isWritingTools()?"writing":"siri";
if(!tag)log("RESPONSE_TAG_MISSING");
else if(!/^aies_[a-z0-9_]{12,90}$/.test(tag))log("RESPONSE_TAG_INVALID");
else log("RESPONSE_TAG_PRESENT");
if(/^aies_[a-z0-9_]{12,90}$/.test(tag)){
 var raw=storeRead("AIES_R1_"+tag);
 try{current=raw&&JSON.parse(raw);}catch(e){}
 storeWrite("AIES_R1_"+tag,""); // consume once, even if invalid
 if(current&&current.exp>Date.now()&&current.exp<=Date.now()+C.sessionTtlMs&&
    current.scene===activeScene&&typeof current.p==="string"&&current.p.length<=C.maxPrompt)prompt2=current.p;
 if(prompt2)log("RESPONSE_PROMPT_FROM_STORE");
 else log("RESPONSE_PROMPT_STORE_MISSING");
}
var fromReq=parseApplePrompt(rawRequest());
if(prompt2&&fromReq&&prompt2!==fromReq){error("CORRELATION_MISMATCH");return;}
if(!prompt2){
 if(fromReq){prompt2=fromReq;log("RESPONSE_PROMPT_FROM_BODY");}
 else log("RESPONSE_PROMPT_BODY_UNAVAILABLE");
}
if(!prompt2){error("PROMPT_UNAVAILABLE");return;}
// Fail before billing DeepSeek if this upstream stream cannot be rewritten.
if(!rewriteSse(res.body,"AIES_VALIDATION_ONLY",activeScene)){error("SSE_REWRITE_UNSUPPORTED");return;}
log("SSE_PREFLIGHT_PASSED");
var key=storeRead(C.keyName);
if(!validKey(key)){error("KEY_NOT_PROVISIONED");return;}
if(!http||typeof http.post!=="function"){error("HTTP_CLIENT_UNAVAILABLE");return;}
if(typeof setTimeout==="function")timer=setTimeout(function(){error("MODEL_TIMEOUT");},C.timeoutMs);
log("DEEPSEEK_STARTED");
try{
 http.post({
  url:C.endpoint,method:"POST",timeout:14,"auto-redirect":false,
  headers:{"Content-Type":"application/json","Accept":"application/json","Authorization":"Bearer "+key},
  body:safeJson({
   model:C.model,stream:false,thinking:{type:"disabled"},max_tokens:1000,
   messages:[
    {role:"system",content:activeScene==="writing"?
     "你是 Apple 写作工具的 DeepSeek 纯文本创作助手。按用户提供的说明和文本进行起草或改写。只返回最终正文，不输出 JSON、代码围栏、引言或无关提示。不要自称千问。AIES 会在最终正文前自动添加来源标记。":
     "你是通过 AIES 转发的 DeepSeek 中文 Siri 问答助手。仅回答用户问题，内容尽量准确、清晰，并在复杂问题中保留必要推理步骤。不要自称千问或 Qwen。用户问来源时如实说明这条回答来自 DeepSeek API，经 AIES 转发；不要自己重复固定来源前缀，AIES 会在每条验证成功的回答正文开头强制添加【DeepSeek · AIES】。"},
    {role:"user",content:prompt2}
   ]
  })
 },function(err,reply,bodyText){
  if(once)return;
  abModel(reply,bodyText,err);
  if(err){error("MODEL_NETWORK");return;}
  var answer=modelReply(reply,bodyText);
  if(!answer){error("MODEL_RESPONSE_INVALID");return;}
  var labeledAnswer=verifiedDeepSeekAnswerWithLabel(answer);
  if(!labeledAnswer){error("MODEL_RESPONSE_INVALID");return;}
  var rewritten=rewriteSse(res.body,labeledAnswer,activeScene);
  if(!rewritten){error("SSE_REWRITE_UNSUPPORTED");return;}
  abSse("AIES_SYNTHETIC",200,rewritten);
  abRecord("AIES_OUTPUT",{rewrittenChars:rewritten.length,markerPresent:rewritten.indexOf(DEEPSEEK_SOURCE_LABEL)>=0});
  if(activeScene==="writing")log("WRITINGTOOLS_DEEPSEEK_PAYLOAD_READY");
  log("DEEPSEEK_LABEL_APPLIED");
  log("DEEPSEEK_RESPONSE_ATTEMPTED");
  done({status:200,headers:{"Content-Type":"text/event-stream; charset=utf-8","Cache-Control":"no-store","X-AIES-Answer-Source":"deepseek"},body:rewritten});
 });
}catch(e){error("MODEL_EXCEPTION");}
})();