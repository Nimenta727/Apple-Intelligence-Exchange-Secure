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
 return typeof s==="string"&&s.length>=1&&s.length<=36&&
  /^[A-Za-z_][A-Za-z0-9_-]*$/.test(s)&&
  !/(?:auth|bearer|cookie|token|secret|password|api.?key|session.?id|device.?id|user.?id|uuid|account|credential|signature|email|phone|address|location|private)/i.test(s)?
  s:"REDACTED_KEY";
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
   /^[A-Za-z][A-Za-z0-9_.\[\]-]*$/.test(raw))return raw;
 return "UNSAFE_EVENT_NAME";
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
 var chunks=raw.replace(/\r\n/g,"\n").replace(/\r/g,"\n").split("\n\n");
 var seq=[],counts={},examples=[],names=[],last=[],ok=0,bad=0,framing={id:false,comments:false,retry:false,multiData:false,missingEvent:false},done=false;
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
try{main();}catch(e){fixed("DIAGNOSTIC_EXCEPTION");}finally{
 // THE ONLY SCRIPT OUTCOME: preserve original Qwen request/response.
 if(typeof $done==="function")$done({});
}
})();