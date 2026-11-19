/*
 * AIES Qwen PASSIVE protocol probe — diagnostic ONLY, no interception edits.
 * Shadowrocket Request and Response hooks share this file. Always $done({}).
 * Disabled by default: local manual helper arms one 600-second observation.
 * Stores bounded JSON FIELD TYPES, SSE EVENT NAMES/ORDER, coarse OS metadata.
 * NEVER stores questions, answers, full HTTP bodies/headers, credentials, IDs.
 * No external HTTP requests or DeepSeek calls.
 */
(function(){
"use strict";
var KEY="AIES_QWEN_PASSIVE_V1_STATE",TTL=600000,MAX_SSE=900000;
var req=typeof $request!=="undefined"?$request:null;
var res=typeof $response!=="undefined"?$response:null;
var store=typeof $persistentStore!=="undefined"?$persistentStore:null;
function fixed(code){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_QWEN_PASSIVE] "+code);}catch(e){}}
function read(){try{return store&&store.read?store.read(KEY):null;}catch(e){return null;}}
function write(s){try{return !!(store&&store.write&&store.write(s,KEY));}catch(e){return false;}}
function isTarget(){
 return req&&typeof req.url==="string"&&
  /^https:\/\/prod-yabuli\.qianwen\.com\/v1\/sessions\/responses(?:\?[^#]*)?$/i.test(req.url);
}
function uaSiri(){
 var headers=req&&req.headers;
 if(!headers||typeof headers!=="object")return false;
 var keys=Object.keys(headers);
 for(var i=0;i<keys.length;i++){
  if(keys[i].toLowerCase()==="user-agent")
   return typeof headers[keys[i]]==="string"&&/^Siri\s*\(/i.test(headers[keys[i]]);
 }
 return false;
}
function safeFieldName(s){
 if(typeof s!=="string"||s.length<1)return "REDACTED_KEY";
 if(/(?:auth|bearer|cookie|token|secret|password|api.?key|session.?id|device.?id|user.?id|uuid|account|credential|signature|email|phone|address|location|private)/i.test(s))
  return "REDACTED_KEY";
 // Siri/Qwen uses an SSE wrapper key equal to its dotted event name.
 // Allow those structured event names (no values), not arbitrary identifiers.
 if(s.length<=105&&/^[A-Za-z][A-Za-z0-9_.\[\]-]*$/.test(s)&&
    /^(?:session|response|message|content|completion|error|ping|done)(?:\.|\[|$)/i.test(s))
  return s;
 if(s.length<=36&&/^[A-Za-z_][A-Za-z0-9_-]*$/.test(s))return s;
 return "REDACTED_KEY";
}
function kind(v){
 if(v===null)return "null";
 if(Array.isArray(v))return "array";
 var t=typeof v;
 return t==="string"||t==="number"||t==="boolean"||t==="object"?t:"other";
}
function shape(v,depth,counters){
 counters.seen++;
 if(counters.seen>120)return "NODE_LIMIT";
 var t=kind(v);
 if(t==="array"){
  if(depth>=4)return {type:"array",lengthBand:v.length===0?"0":v.length===1?"1":v.length<=5?"2-5":"6+"};
  return {type:"array",lengthBand:v.length===0?"0":v.length===1?"1":v.length<=5?"2-5":"6+",
   item:v.length?shape(v[0],depth+1,counters):"empty"};
 }
 if(t!=="object")return t; // NEVER returns string/number/boolean values.
 if(depth>=4)return "object";
 var keys=Object.keys(v),fields=[];
 for(var i=0;i<keys.length&&i<10;i++)
  fields.push({key:safeFieldName(keys[i]),value:shape(v[keys[i]],depth+1,counters)});
 if(keys.length>10)fields.push({key:"TRUNCATED",value:"other"});
 return {type:"object",fields:fields};
}
function safeDeviceInfo(o){
 var cfg=o&&o.configuration,query=cfg&&cfg.query;
 if(!query||typeof query!=="object"||Array.isArray(query))return null;
 var result={},p=query.platform,l=query.locale;
 if(p==="iOS"||p==="iPadOS"||p==="macOS")result.platform=p;
 if(typeof l==="string"&&/^[a-z]{2,3}_[A-Z]{2}$/.test(l))result.locale=l;
 var names=["os_major_version","os_minor_version","os_patch_version"];
 for(var i=0;i<names.length;i++){
  var v=query[names[i]];
  if(typeof v==="number"&&isFinite(v)&&v>=0&&v<=100&&Math.floor(v)===v)result[names[i]]=v;
 }
 var group=cfg&&cfg.response_configuration_group_id;
 result.group=group==="siri.multimodal.noRTI"?"siri.multimodal.noRTI":"OTHER_OR_MISSING";
 return result;
}
function requestSummary(){
 var raw=req&&req.body;
 if(typeof raw!=="string")return {bodyStatus:"NON_TEXT_OR_UNAVAILABLE"};
 if(raw.length>300000)return {bodyStatus:"TOO_LARGE"};
 var obj;
 try{obj=JSON.parse(raw);}catch(e){return {bodyStatus:"NOT_JSON"};}
 if(!obj||typeof obj!=="object"||Array.isArray(obj))return {bodyStatus:"UNSUPPORTED_ROOT"};
 var out={bodyStatus:"JSON_OBJECT",schema:shape(obj,0,{seen:0}),device:safeDeviceInfo(obj)};
 // Deliberately no request text, decoded values, tool descriptions or headers.
 return out;
}
function eventName(raw){
 if(typeof raw==="string"&&raw.length<=105&&
   /^[A-Za-z][A-Za-z0-9_.\[\]-]*$/.test(raw)&&
   /^(?:session|response|message|content|completion|error|ping|done)(?:\.|\[|$)/i.test(raw))return raw;
 return "UNSAFE_EVENT_NAME";
}
// Match the CURRENT v0.6 60 rewriteSse() preflight decisions, but output
// only a fixed enum. No SSE payload, IDs, timestamps or text ever persisted.
// Diagnostic parity must be updated if 60's validation logic is revised.
function strict60Preflight(raw){
 if(typeof raw!=="string"||!raw.length||raw.length>900000)return "STREAM_UNAVAILABLE";
 var events=[
  "session.created","session.response.created",
  "session.response.choices[].added",
  "session.response.choices[].items[].added",
  "session.response.choices[].items[].message.content[].added",
  "session.response.choices[].items[].message.content[].text.value.delta",
  "session.response.choices[].items[].message.content[].text.value.done",
  "session.response.choices[].items[].message.content[].done",
  "session.response.choices[].items[].done",
  "session.response.choices[].completed",
  "session.response.choices[].done","session.response.done"
 ];
 // Complex Siri responses can stream Qwen citation annotations. The new 60
 // discards them only in the observed location after text.value.done and
 // before content.done. Their values must never reach DeepSeek or its output.
 var annotation="session.response.choices[].items[].message.content[].text.annotations[].added";
 var frames=raw.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n\n"),rows=[],i;
 for(i=0;i<frames.length;i++){
  var trimmed=frames[i].trim();
  if(!trimmed)continue;
  var lines=trimmed.split("\n"),name="",data=[],j;
  for(j=0;j<lines.length;j++){
   var line=lines[j],colon=line.indexOf(":"),field=colon<0?line:line.slice(0,colon);
   if(line.charAt(0)===":"||!line.trim())continue;
   var value=colon<0?"":line.slice(colon+1).replace(/^ /,"");
   if(field==="event"){if(name)return "FRAME_LAYOUT_UNSUPPORTED";name=value;}
   else if(field==="data"){data.push(value);if(data.length>16)return "FRAME_LAYOUT_UNSUPPORTED";}
   else if(field!=="id"&&field!=="retry")return "FRAME_LAYOUT_UNSUPPORTED";
  }
  if(!name||!data.length)return "FRAME_LAYOUT_UNSUPPORTED";
  if(events.indexOf(name)<0&&name!==annotation)return "EVENT_UNKNOWN";
  var obj;
  try{obj=JSON.parse(data.join("\n"));}catch(e){return "EVENT_JSON_INVALID";}
  if(!obj||obj.type!==name||!Object.prototype.hasOwnProperty.call(obj,name))
   return "EVENT_ENVELOPE_INVALID";
  rows.push({name:name,payload:obj[name]});
 }
 if(rows.length<12||rows.length>256)return "EVENT_COUNT_UNSUPPORTED";
 var cleaned=[],seenTextDone=false,seenContentDone=false,annotations=0;
 for(i=0;i<rows.length;i++){
  var r=rows[i];
  if(r.name===annotation){
   if(!seenTextDone||seenContentDone||++annotations>64||
      !r.payload||typeof r.payload!=="object"||Array.isArray(r.payload))
    return "ANNOTATION_POSITION_OR_TYPE_UNSUPPORTED";
   continue;
  }
  if(r.name===events[6]){
   if(seenTextDone)return "EVENT_ORDER_UNSUPPORTED";
   seenTextDone=true;
  }
  if(r.name===events[7])seenContentDone=true;
  cleaned.push(r);
 }
 rows=cleaned;
 if(rows.length<12||rows.length>256)return "EVENT_COUNT_UNSUPPORTED";
 for(i=0;i<5;i++)if(rows[i].name!==events[i])return "EVENT_ORDER_UNSUPPORTED";
 for(i=0;i<6;i++)if(rows[rows.length-6+i].name!==events[6+i])
  return "EVENT_ORDER_UNSUPPORTED";
 for(i=5;i<rows.length-6;i++)if(rows[i].name!==events[5])
  return "EVENT_ORDER_UNSUPPORTED";
 var session=rows[0].payload,response=rows[1].payload;
 var validId=function(v){return typeof v==="string"&&/^[A-Za-z0-9_-]{1,160}$/.test(v);};
 if(!session||!response||!validId(session.id)||!validId(response.id))
  return "SESSION_OR_RESPONSE_ID_INVALID";
 if(response.session_id!==session.id)return "SESSION_LINK_MISMATCH";
 var expiry=session.expires_at;
 if(typeof expiry!=="number"||!isFinite(expiry)||expiry<0||expiry>9999999999999||
    Math.floor(expiry)!==expiry)return "SESSION_EXPIRY_INVALID";
 return "MATCHES_60_PREFLIGHT";
}
function responseSummary(){
 var status=res&&(res.statusCode||res.status);
 var code=typeof status==="number"?status:Number(status||0);
 var out={status:code>=100&&code<=599?code:0};
 var raw=res&&res.body;
 if(typeof raw!=="string"){out.bodyStatus="NON_TEXT_OR_UNAVAILABLE";return out;}
 out.bodyStatus="TEXT";
 out.lengthBand=raw.length===0?"0":raw.length<1000?"1-999":raw.length<10000?"1K-10K":raw.length<100000?"10K-100K":"100K+";
 if(raw.length>MAX_SSE){out.bodyStatus="TOO_LARGE";return out;}
 if(!/(?:^|\n)(?:event|data)\s*:/m.test(raw)){
  try{
   var json=JSON.parse(raw);
   out.format="JSON_NON_SSE";
   out.schema=shape(json,0,{seen:0});
  }catch(e){out.format="OTHER_NON_SSE";}
  return out;
 }
 out.format="SSE";
 out.strict60Preflight=strict60Preflight(raw);
 var chunks=raw.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n\n");
 var seq=[],counts=[],examples=[],names=[],last=[],ok=0,bad=0,framing={id:false,comments:false,retry:false,multiData:false,missingEvent:false},done=false;
 for(var i=0;i<chunks.length&&i<500;i++){
  var frame=chunks[i];if(!frame.trim())continue;
  var lines=frame.split("\n"),ename="",data=[],seenData=false;
  for(var j=0;j<lines.length;j++){
   var line=lines[j];
   if(line.charAt(0)===":"){framing.comments=true;continue;}
   var n=line.indexOf(":"),field=n>=0?line.slice(0,n):line;
   if(field==="event")ename=line.slice(n+1).trim();
   else if(field==="data"){data.push(line.slice(n+1).replace(/^ /,""));seenData=true;}
   else if(field==="id")framing.id=true;
   else if(field==="retry")framing.retry=true;
  }
  if(!ename)framing.missingEvent=true;
  if(data.length>1)framing.multiData=true;
  var name=eventName(ename||"NO_EVENT");
  if(seq.length<36)seq.push(name);
  last.push(name);if(last.length>16)last.shift();
  var match=-1;for(var k=0;k<counts.length;k++)if(counts[k].event===name){match=k;break;}
  if(match>=0)counts[match].count++;
  else if(counts.length<28)counts.push({event:name,count:1});
  if(!seenData){bad++;continue;}
  var joined=data.join("\n");
  if(joined==="[DONE]"){done=true;continue;}
  try{
   var obj=JSON.parse(joined);ok++;
   var exists=false;for(var q=0;q<examples.length;q++)if(examples[q].event===name)exists=true;
   if(!exists&&examples.length<16)
    examples.push({event:name,schema:shape(obj,0,{seen:0})});
  }catch(e){bad++;}
 }
 out.framesScanned=Math.min(chunks.length,500);
 out.truncated=chunks.length>500;
 out.orderFirst=seq;
 out.orderLast=last;
 out.eventCounts=counts;
 out.schemaExamples=examples;
 out.jsonDataFrames=ok;
 out.unparsedFrames=bad;
 out.doneMarker=done;
 out.framing=framing;
 return out;
}
// Additional manually armed A/B native-Qwen comparison. Main 61 remains
// read-only and its older structure-only probe is completely independent.
// A controlled, NON-PRIVATE test answer may be shown at manual readout.
var AB_NATIVE_KEY="AIES_AB_NATIVE_V1_STATE",AB_NATIVE_TTL=600000;
function abNativeTarget(){
 return req&&typeof req.url==="string"&&
  (/^https:\/\/prod-yabuli\.qianwen\.com\/v1\/sessions\/responses(?:\?[^#]*)?$/i.test(req.url)||
   /^https:\/\/prod-yabuli\.qianwen\.com\/v1\/sessions\/[^\/?#]{1,160}\/responses(?:\?[^#]*)?$/i.test(req.url));
}
function abNativeRoute(){
 return isTarget()?"MAIN":"SESSION_FOLLOWUP";
}
function abNativeAnswer(raw){
 if(typeof raw!=="string"||raw.length>MAX_SSE)return {text:"",chars:0,truncated:false};
 var frames=raw.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n\n"),
  found="",parts=[];
 for(var i=0;i<frames.length&&i<400;i++){
  var name="",data=[],lines=frames[i].split("\n");
  for(var j=0;j<lines.length;j++){
   if(lines[j].slice(0,6)==="event:")name=lines[j].slice(6).trim();
   if(lines[j].slice(0,5)==="data:")data.push(lines[j].slice(5).replace(/^ /,""));
  }
  if(!/\.text\.value\.(?:done|delta)$/.test(name))continue;
  try{
   var envelope=JSON.parse(data.join("\n")),payload=envelope&&envelope[name];
   if(name.slice(-5)===".done"&&typeof payload.value==="string")found=payload.value;
   if(name.slice(-6)===".delta"&&typeof payload.delta==="string"&&parts.length<50)
    parts.push(payload.delta);
  }catch(e){}
 }
 if(!found)found=parts.join("");
 // The content was observed as a JSON text property in Siri responses.
 // Do not collect response metadata, tools, reasoning or raw SSE.
 try{
  var obj=JSON.parse(found);
  if(obj&&typeof obj.content==="string")found=obj.content;
 }catch(e){}
 var originalLength=found.length;
 found=found.replace(/\bsk-[A-Za-z0-9_-]{8,}\b/g,"[REDACTED_KEY]")
  .replace(/\bBearer\s+[A-Za-z0-9._-]{8,}\b/ig,"[REDACTED_AUTH]")
  .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/ig,"[REDACTED_EMAIL]")
  .replace(/https?:\/\/[^\s"'<>]+/ig,"[REDACTED_URL]");
 return {text:found.slice(0,7000),chars:originalLength,truncated:found.length>7000};
}
function abNativeCapture(){
 if(!abNativeTarget()||!uaSiri())return;
 var raw=store&&store.read?store.read(AB_NATIVE_KEY):null,st=null,now=Date.now();
 try{st=raw&&JSON.parse(raw);}catch(e){return;}
 if(!st||st.v!==1||st.phase!=="armed"||
    typeof st.createdAt!=="number"||typeof st.expiresAt!=="number"||
    st.createdAt>now||st.expiresAt<=now||st.expiresAt>now+AB_NATIVE_TTL||
    !Array.isArray(st.records)||st.records.length>=9)return;
 var route=abNativeRoute(),rec={tMs:Math.max(0,now-st.createdAt),route:route};
 if(!res){
  var method=String(req.method||req.httpMethod||"").toUpperCase();
  if(method!=="POST")return;
  rec.stage="NATIVE_REQUEST";
  rec.shape=requestSummary();
 }else{
  rec.stage="NATIVE_RESPONSE";
  rec.shape=responseSummary();
  var answer=abNativeAnswer(res.body);
  rec.answerChars=answer.chars;
  rec.answerText=answer.text;
  rec.answerTruncated=answer.truncated;
 }
 st.records.push(rec);
 var packed=JSON.stringify(st);
 if(packed.length>47000)return;
 if(store&&store.write&&store.write(packed,AB_NATIVE_KEY))
  fixed(res?"AB_NATIVE_RESPONSE_CAPTURED_LOCAL":"AB_NATIVE_REQUEST_CAPTURED_LOCAL");
}

// Separate, opt-in WritingTools-only request/SSE shape probe.
// It NEVER captures selected text, model answers, secrets or raw HTTP bytes.
// This preserves the default Siri-only and A/B diagnostic privacy boundaries.
var WRITING_STATE="AIES_WRITING_SCHEMA_V1",WRITING_WINDOW=600000;
function writingAgent(){
 var headers=req&&req.headers;
 if(!headers||typeof headers!=="object")return false;
 var keys=Object.keys(headers);
 for(var i=0;i<keys.length;i++)if(keys[i].toLowerCase()==="user-agent")
  return typeof headers[keys[i]]==="string"&&
   /^WritingTools(?:\s|\()/i.test(headers[keys[i]]);
 return false;
}
function writingGroupId(){
 if(!req||typeof req.body!=="string"||req.body.length>300000)return "BODY_UNAVAILABLE";
 var obj=null;try{obj=JSON.parse(req.body);}catch(e){return "JSON_INVALID";}
 var g=obj&&obj.configuration&&obj.configuration.response_configuration_group_id;
 // This is a software SCENE ID, not prompt text. Never echo arbitrary JSON.
 if(typeof g!=="string"||g.length<2||g.length>80||
    !/^[a-z][a-z0-9_.-]*$/i.test(g)||
    /(?:bearer|token|secret|password|api.?key|account|email|phone|private)/i.test(g)||
    /[a-z0-9]{30,}/i.test(g))return "UNSAFE_OR_MISSING_GROUP";
 return g;
}
function writingShapeProbe(){
 if(!abNativeTarget()||!writingAgent())return;
 var method=String(req&& (req.method||req.httpMethod)||"").toUpperCase();
 if(method!=="POST")return;
 var raw=store&&store.read?store.read(WRITING_STATE):null,st=null,now=Date.now();
 try{st=raw&&JSON.parse(raw);}catch(e){return;}
 if(!st||st.v!==1||st.phase!=="armed"||
    typeof st.createdAt!=="number"||typeof st.expiresAt!=="number"||
    st.createdAt>now||st.expiresAt<=now||st.expiresAt>now+WRITING_WINDOW||
    !Array.isArray(st.records)||st.records.length>=6)return;
 var record={tMs:Math.max(0,now-st.createdAt),
  route:abNativeRoute(),stage:res?"WRITING_RESPONSE":"WRITING_REQUEST"};
 if(res){
  record.shape=responseSummary(); // event names and JSON types only, no answer
 }else{
  record.group=writingGroupId();
  record.shape=requestSummary(); // whitelisted field/type hierarchy only
 }
 st.records.push(record);
 var packed=JSON.stringify(st);
 if(packed.length>45000)return;
 if(store&&store.write&&store.write(packed,WRITING_STATE))
  fixed(res?"WRITING_RESPONSE_SCHEMA_CAPTURED_LOCAL":"WRITING_REQUEST_SCHEMA_CAPTURED_LOCAL");
}

// Independently armed, structure-only Siri *session follow-up* observer.
// Request and response are separate observations, NEVER presumed same txn.
// No user text, answers, URLs, session IDs, headers or model credentials saved.
// The 60 production guard remains unchanged until device schema is confirmed.
var FOLLOWUP_STATE="AIES_SIRI_FOLLOWUP_SCHEMA_V1",FOLLOWUP_WINDOW=600000;
function followupShapeProbe(){
 if(!req||!abNativeTarget()||isTarget()||!uaSiri())return;
 if(String(req.method||req.httpMethod||"").toUpperCase()!=="POST")return;
 var raw=store&&store.read?store.read(FOLLOWUP_STATE):null,st=null,now=Date.now();
 try{st=raw&&JSON.parse(raw);}catch(e){return;}
 if(!st||st.v!==1||st.phase!=="armed"||!Array.isArray(st.records)||
    typeof st.createdAt!=="number"||typeof st.expiresAt!=="number"||
    st.createdAt>now||st.expiresAt<=now||st.expiresAt>now+FOLLOWUP_WINDOW||
    st.records.length>=8)return;
 var rec={tMs:Math.max(0,now-st.createdAt),
  stage:res?"FOLLOWUP_RESPONSE":"FOLLOWUP_REQUEST",route:"SESSION_FOLLOWUP"};
 if(res){
  var summary=responseSummary();
  rec.shape={status:summary.status,bodyStatus:summary.bodyStatus,
   format:summary.format||"UNAVAILABLE",lengthBand:summary.lengthBand||"UNAVAILABLE",
   strict60Preflight:summary.strict60Preflight||"UNAVAILABLE",
   orderFirst:summary.orderFirst||[],orderLast:summary.orderLast||[],
   eventCounts:summary.eventCounts||[],jsonDataFrames:summary.jsonDataFrames||0,
   unparsedFrames:summary.unparsedFrames||0,framing:summary.framing||{}};
 }else rec.shape=requestSummary(); // field types only; no text values
 st.records.push(rec);
 var packed=JSON.stringify(st);
 if(packed.length>45000)return;
 if(store&&store.write&&store.write(packed,FOLLOWUP_STATE))
  fixed(res?"FOLLOWUP_RESPONSE_SCHEMA_CAPTURED_LOCAL":"FOLLOWUP_REQUEST_SCHEMA_CAPTURED_LOCAL");
}
function main(){
 if(!isTarget()||!req||String(req.method||req.httpMethod||"").toUpperCase()!=="POST"||!uaSiri())return;
 var st=null,now=Date.now(),raw=read();
 try{st=raw&&JSON.parse(raw);}catch(e){return;}
 if(!st||st.v!==1||st.phase!=="armed"||
   typeof st.createdAt!=="number"||typeof st.expiresAt!=="number"||
   st.createdAt>now||st.expiresAt<=now||st.expiresAt>now+TTL)return;
 if(!res){
  if(st.request!==null)return;
  st.request=requestSummary();
  st.requestAt=now;
  if(write(JSON.stringify(st)))fixed("REQUEST_SCHEMA_CAPTURED_LOCAL");
  else fixed("STORE_FAILED");
  return;
 }
 if(st.response!==null)return;
 st.response=responseSummary();
 st.responseAt=now;
 // No header injection or "latest query" association. Observations on one
 // target URL may be unrelated if multiple Siri requests run concurrently.
 if(write(JSON.stringify(st)))fixed("RESPONSE_SSE_SCHEMA_CAPTURED_LOCAL");
 else fixed("STORE_FAILED");
}
try{try{followupShapeProbe();}catch(e){fixed("FOLLOWUP_SCHEMA_CAPTURE_FAILED");}try{writingShapeProbe();}catch(e){fixed("WRITING_SCHEMA_CAPTURE_FAILED");}try{abNativeCapture();}catch(e){fixed("AB_NATIVE_CAPTURE_FAILED");}main();}catch(e){fixed("DIAGNOSTIC_EXCEPTION");}finally{
 // THE ONLY SCRIPT OUTCOME: preserve original Qwen request/response.
 if(typeof $done==="function")$done({});
}
})();