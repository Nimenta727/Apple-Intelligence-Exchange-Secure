/*
 * AIES v0.7 request-first experimental Siri/DeepSeek engine.
 * Independent 63 LOCAL module. ONLY native Siri pure-text request hooks.
 * Four layers: strict input gate -> verified session -> synthetic SSE
 * -> async DeepSeek + direct response. No response-side transaction tag.
 * Real Siri UI compatibility requires device verification.
 */
(function () {
"use strict";
var C={
  version:"0.7.0-request-first-experimental",
  target:/^https:\/\/prod-yabuli\.qianwen\.com\/v1\/sessions\/responses(?:\?[^#]*)?$/i,
  // Real Siri also used session-scoped response URLs, absent from old Hook.
  followup:/^https:\/\/prod-yabuli\.qianwen\.com\/v1\/sessions\/[^\/?#]{1,160}\/responses(?:\?[^#]*)?$/i,
  endpoint:"https://api.deepseek.com/chat/completions",
  model:"deepseek-flash",
  keyName:"SAIRS_DEEPSEEK_API_KEY",
  maxRequest:300000,maxPrompt:14000,maxSse:900000,maxAnswer:12000,
  timeoutMs:15000,sessionTtlMs:45000,followupContextTtlMs:300000
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
function log(s){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_V07] "+s);}catch(e){}}
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

// ── CLIENT GATE: bounded request shape, pure user text ──
var requestGroup=null;
function isSiriForProbe(){
 return /^Siri\s*\(/i.test(header(req&&req.headers,"User-Agent"));
}
function safeGroupIdentifier(v){
 return typeof v==="string"&&v.length>=2&&v.length<=80&&
   /^[A-Za-z][A-Za-z0-9_.-]*$/.test(v)&&
   !/[A-Za-z0-9]{25,}/.test(v)&&
   !/^(?:bearer|token|secret|sk-)/i.test(v);
}

function isV07StructuralSiriGroup(v){
 return safeGroupIdentifier(v)&&/^siri[._][A-Za-z0-9_.-]{2,58}$/i.test(v)&&
   !/(?:tool|action|execute|automation|audio|video|image|camera|visual|location|media)/i.test(v);
}
function isV07AllowedFollowupGroup(v){
 return v==="siri.multimodal.noRTI"||
   /^(siri\.tqa|siri_tqa)$/i.test(v)||
   isV07StructuralSiriGroup(v);
}
function observedSiriTextEnvelopeReasons(o,isFollowupRoute){
 // Exact field names and field TYPES confirmed by the local iPad schema probe.
 // Root metadata is not forwarded to DeepSeek. Unknown keys, tool calls, media
 // and unsupported message types remain blocked by this and textAtom().
 var reasons=[],top=Object.keys(o);
 var allowedRoot=["configuration","input","client_tools","input_hint","response_format","server_tools","stream"];
 if(isFollowupRoute)allowedRoot.push("previous_choice_id");
 if(isFollowupRoute&&Object.prototype.hasOwnProperty.call(o,"previous_choice_id")&&
    o.previous_choice_id!==null&&typeof o.previous_choice_id!=="string")
  reasons.push("PREVIOUS_CHOICE_NOT_STRING");
 else if(isFollowupRoute&&typeof o.previous_choice_id==="string"&&
    o.previous_choice_id!==""&&!validId(o.previous_choice_id))
  reasons.push("PREVIOUS_CHOICE_INVALID");
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
function parseRequest(raw,allowRecoveredSiri,followupMode){
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
   var tqaGroup=/^(siri\.tqa|siri_tqa)$/i.test(g);
   var structuralFollowup=!!followupMode&&isV07StructuralSiriGroup(g)&&
     !observedGroup&&!tqaGroup;
   if(!observedGroup&&!tqaGroup&&!structuralFollowup){
    requestDiagnostic=followupMode?"FOLLOWUP_GROUP_UNVERIFIED":"GROUP_UNSUPPORTED";
    if(followupMode)log("FOLLOWUP_GROUP_BLOCKED");
    else log("MAIN_GROUP_BLOCKED");
    return null;
   }
   // All v0.7 traffic MUST prove Siri User-Agent and observed pure-text
   // envelope even for a formerly known TQA group.
   if(!isSiriForProbe()&&!allowRecoveredSiri){
    requestDiagnostic="GROUP_UNSUPPORTED";return null;
   }
   if(structuralFollowup)log("FOLLOWUP_STRUCTURAL_GROUP_CANDIDATE");
   else if(followupMode)log("FOLLOWUP_KNOWN_GROUP_CANDIDATE");
   // Regardless of known/structural group, enforce the SAME Siri text shape.
   {
   var shapeReasons=observedSiriTextEnvelopeReasons(o,!!followupMode);
   if(followupMode){
    // Only fixed classification codes are logged, never the opaque choice value.
    var pc=o.previous_choice_id;
    if(!Object.prototype.hasOwnProperty.call(o,"previous_choice_id"))
     log("FOLLOWUP_PREVIOUS_CHOICE_MISSING");
    else if(pc===null)log("FOLLOWUP_PREVIOUS_CHOICE_NULL");
    else if(pc==="")log("FOLLOWUP_PREVIOUS_CHOICE_EMPTY");
    else if(typeof pc!=="string")log("FOLLOWUP_PREVIOUS_CHOICE_NONSTRING_UNSUPPORTED");
    else if(!validId(pc))log(pc.length>160?
      "FOLLOWUP_PREVIOUS_CHOICE_OVERSIZE":"FOLLOWUP_PREVIOUS_CHOICE_NONCANONICAL");
   }
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

// ── MODEL/PROVENANCE AND STRICT SSE: no Qwen text copied ──
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
function rewriteSse(original,answer,scene,route,expectedSession){
 if(scene!=="writing")scene="siri";
 route=route==="followup"?"followup":"main";
 if(route==="followup"&&(scene!=="siri"||!validId(expectedSession)))return null;
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
 if(entries.length<(route==="followup"?11:12)||entries.length>256)return null;
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
 if(entries.length<(route==="followup"?11:12)||entries.length>256)return null;
 var names=entries.map(function(x){return x.name;});
 var prefix=route==="followup"?[E.created,E.choice,E.item,E.added]:
  [E.session,E.created,E.choice,E.item,E.added];
 var suffix=[E.textDone,E.contentDone,E.itemDone,E.completed,E.choiceDone,E.responseDone];
 for(i=0;i<prefix.length;i++)if(names[i]!==prefix[i])return null;
 for(i=0;i<6;i++)if(names[names.length-6+i]!==suffix[i])return null;
 for(i=prefix.length;i<names.length-6;i++)if(names[i]!==E.delta)return null;
 var r=entries[route==="followup"?0:1].payload;
 var s=route==="followup"?{id:expectedSession,expires_at:Math.floor(Date.now()/1000)+120}:
   entries[0].payload;
 if(!s||!r||!validId(s.id)||!validId(r.id)||r.session_id!==s.id||
    !validEpoch(s.expires_at))return null;
 // Modality / safety: never synthesize an answer for active tool executions,
 // notices, moderation decisions or unexpected non-message output.
 var offset=route==="followup"?-1:0;
 var choiceAdded=entries[2+offset].payload&&entries[2+offset].payload.choice;
 var itemAdded=entries[3+offset].payload&&entries[3+offset].payload.item;
 var choiceCompleted=entries[entries.length-3].payload&&entries[entries.length-3].payload.choice;
 var choiceDone=entries[entries.length-2].payload&&entries[entries.length-2].payload.choice;
 var lastResponse=entries[entries.length-1].payload;
 var lastChoice=lastResponse&&Array.isArray(lastResponse.choices)&&lastResponse.choices[0];
 if(!lastResponse||lastResponse.id!==r.id||
    (typeof lastResponse.session_id!=="undefined"&&lastResponse.session_id!==s.id)||
    !emptyOrMissing(r.notices)||!emptyOrMissing(lastResponse&&lastResponse.notices)||
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
 var contentAdded=entries[4+offset].payload&&entries[4+offset].payload.content;
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
 if(route==="followup")start.shift(); // No session.created in observed followup SSE.
 var out=[],n=start.slice();
 for(i=start.length;i<names.length-6;i++)
  n.push({item_index:0,choice_index:0,content_index:0,delta:i===start.length?content:""});
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

// ── VERIFIED SESSION AND REQUEST-FIRST RESPONSE ──
// The previous_choice_id is an opaque Qwen continuation pointer, never
// submitted to DeepSeek. A valid followup can use ONLY prior locally verified
// DeepSeek text, scoped to the same session, with a five-minute logical TTL.
// This transient device-local context contains plain user/model text; it is
// not logged, and its TTL does not claim physical secure erasure.
function followupSessionId(){
 if(!req||typeof req.url!=="string")return "";
 var m=req.url.match(/^https:\/\/prod-yabuli\.qianwen\.com\/v1\/sessions\/([^\/?#]{1,160})\/responses(?:\?[^#]*)?$/i);
 return m&&validId(m[1])?m[1]:"";
}
function followupIds(){
 var sid=followupSessionId(),obj=null;
 if(!sid||!req||typeof req.body!=="string"||
    !req.body.length||req.body.length>C.maxRequest)return null;
 try{obj=JSON.parse(req.body);}catch(e){return null;}
 if(!obj||typeof obj!=="object"||Array.isArray(obj)||
    !obj.configuration||
    !isV07AllowedFollowupGroup(obj.configuration.response_configuration_group_id))return null;
 var present=Object.prototype.hasOwnProperty.call(obj,"previous_choice_id");
 var v=obj.previous_choice_id,kind=present?(v===null?"null":
    typeof v==="string"?(v===""?"empty":"canonical"):"invalid"):"missing";
 if(kind==="invalid"||(kind==="canonical"&&!validId(v)))return null;
 return {sid:sid,prev:v,kind:kind};
}
// Null, absent, or empty previous_choice_id are supported only with the
// exact URL session's locally verified DeepSeek answer and unexpired choice.
// Never accept nonempty mismatched pointers, wrong types, or other sessions.
function latestVerifiedSessionChoice(sid){
 if(!validId(sid))return null;
 var raw=storeRead("AIES_CTX_SESSION_"+sid),v=null,now=Date.now();
 if(typeof raw!=="string"||raw.length>1000)return null;
 try{v=JSON.parse(raw);}catch(e){return null;}
 if(!v||v.v!==1||v.sid!==sid||!validId(v.choice)||
    typeof v.exp!=="number"||v.exp<=now||
    v.exp>now+C.followupContextTtlMs)return null;
 return verifiedHistory(v.choice,sid)?v.choice:null;
}
function resolveFollowupChoice(details){
 if(!details||!validId(details.sid))return null;
 if(details.kind==="canonical")return validId(details.prev)&&
   verifiedHistory(details.prev,details.sid)?details.prev:null;
 if(details.kind!=="empty"&&details.kind!=="null"&&details.kind!=="missing")
  return null;
 // Missing, null or empty continuation pointer: fall back ONLY to verified
 // DeepSeek history from EXACTLY this URL session, never a global latest.
 return latestVerifiedSessionChoice(details.sid);
}
function verifiedHistory(prev,sid){
 if(!validId(prev)||!validId(sid))return null;
 var raw=storeRead("AIES_CTX_"+prev),v=null,now=Date.now();
 if(typeof raw!=="string"||raw.length>36000)return null;
 try{v=JSON.parse(raw);}catch(e){return null;}
 if(!v||v.v!==1||v.sid!==sid||v.exp<=now||
    v.exp>now+C.followupContextTtlMs||!Array.isArray(v.messages)||
    !v.messages.length||v.messages.length>6||v.messages.length%2!==0)return null;
 var size=0;
 for(var i=0;i<v.messages.length;i++){
  var msg=v.messages[i],role=i%2===0?"user":"assistant";
  if(!msg||msg.role!==role||typeof msg.content!=="string"||
     !msg.content.length||msg.content.length>C.maxPrompt)return null;
  size+=msg.content.length;
 }
 return size<=30000?v.messages:null;
}
function saveVerifiedHistory(rewritten,prompt,answer,previous){
 if(typeof rewritten!=="string"||typeof prompt!=="string"||
    typeof answer!=="string"||prompt.length>C.maxPrompt||
    answer.length>C.maxAnswer)return false;
 var frames=rewritten.split("\n\n"),sid="",choiceId="";
 for(var i=0;i<frames.length;i++){
  var lines=frames[i].split("\n"),name="",json=null;
  for(var j=0;j<lines.length;j++)if(lines[j].indexOf("event: ")===0)
   name=lines[j].slice(7);
  if(name!==E.session&&name!==E.created&&name!==E.choice)continue;
  for(var k=0;k<lines.length;k++)if(lines[k].indexOf("data: ")===0){
   try{json=JSON.parse(lines[k].slice(6));}catch(e){}
  }
  var p=json&&json[name];
  if(!p)continue;
  if(name===E.session&&validId(p.id))sid=p.id;
  if(name===E.created&&validId(p.session_id))sid=p.session_id;
  if(name===E.choice&&p.choice&&validId(p.choice.id))choiceId=p.choice.id;
 }
 if(!validId(sid)||!validId(choiceId))return false;
 var msgs=Array.isArray(previous)?previous.slice(-4):[];
 msgs.push({role:"user",content:prompt},{role:"assistant",content:answer});
 var packed=safeJson({v:1,sid:sid,exp:Date.now()+C.followupContextTtlMs,messages:msgs});
 if(packed.length>32000)return false;
 if(!storeWrite("AIES_CTX_"+choiceId,packed))return false;
 // This slot stores only a validated choice pointer, not prompt/answer data.
 // It enables a narrow fallback when Siri uses previous_choice_id: "".
 var marker=safeJson({v:1,sid:sid,choice:choiceId,
   exp:Date.now()+C.followupContextTtlMs});
 return storeWrite("AIES_CTX_SESSION_"+sid,marker);
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
// v0.7 REQUEST-FIRST transport. Deliberately does not use a second
// http-response hook or a cross-hook X-AIES-Request-ID. Every accepted Siri
// query is paired with its own async DeepSeek callback and synthetic response.
function buildSyntheticSiriSkeleton(sid,route){
 if(!validId(sid)||route!=="main"&&route!=="followup")return null;
 var now=Math.floor(Date.now()/1000);
 var rid="resp_"+randomToken(),choiceId="choice_"+randomToken();
 var continueUrl="https://prod-yabuli.qianwen.com/v1/sessions/"+sid+"/responses";
 var session={id:sid,object:"realtime.session",
  created_at:now,last_active_at:now,expires_at:now+120,
  expires_after:{seconds:120,anchor:"created_at"}};
 var response={id:rid,session_id:sid,object:"realtime.response",
  created_at:now,notices:[],choices:[]};
 var openChoice={id:choiceId,status:"in_progress",output:[],continue_url:continueUrl};
 var contents={type:"text",text:{annotations:[],value:"AIES_INTERNAL_PLACEHOLDER"}};
 var output={type:"message",message:{role:"assistant",content:[contents]}};
 var closedChoice={id:choiceId,status:"completed",output:[output],
   moderation:[],continue_url:continueUrl};
 var frames=[];
 if(route==="main")frames.push(event(E.session,session));
 frames.push(
  event(E.created,response),
  event(E.choice,{index:0,choice:openChoice}),
  event(E.item,{choice_index:0,index:0,item:{type:"message",
    message:{role:"assistant",content:[]}}}),
  event(E.added,{choice_index:0,item_index:0,index:0,
    content:{type:"text",text:{annotations:[],value:""}}}),
  event(E.delta,{choice_index:0,item_index:0,content_index:0,
    delta:"AIES_INTERNAL_PLACEHOLDER"}),
  event(E.textDone,{choice_index:0,item_index:0,content_index:0,
    value:"AIES_INTERNAL_PLACEHOLDER"}),
  event(E.contentDone,{choice_index:0,item_index:0,index:0,content:contents}),
  event(E.itemDone,{choice_index:0,index:0,item:output}),
  event(E.completed,{index:0,choice:closedChoice}),
  event(E.choiceDone,{index:0,choice:closedChoice}),
  event(E.responseDone,{id:rid,session_id:sid,object:"realtime.response",
    created_at:now,notices:[],choices:[closedChoice]})
 );
 return frames.join("");
}
if(!isTarget()&&!isFollowup()){done({});return;}
// 63 has request-only hooks. A surprising response invocation must not perform
// a DeepSeek call or consume/rewrite any unrelated Siri or Qwen response.
if(res){log("RESPONSE_HOOK_NOT_INSTALLED");done({});return;}
// Other clients such as WritingTools remain untouched, as in 62.
if(!isSiriForProbe()){done({});return;}
var followupRoute=isFollowup();
if(String(req.method||req.httpMethod||"").toUpperCase()!=="POST"){
 error("INVALID_METHOD");return;
}
var requestRaw=rawRequest();
var prompt=parseRequest(requestRaw,"",followupRoute);
if(!prompt){log("REQUEST_DIAG_"+requestDiagnostic);error("UNSUPPORTED_SIRI_REQUEST");return;}
var details=followupRoute?followupIds():null;
var choice=followupRoute?resolveFollowupChoice(details):null;
if(followupRoute&&!choice){error("FOLLOWUP_CONTEXT_UNAVAILABLE");return;}
var previous=followupRoute?verifiedHistory(choice,details.sid):[];
if(followupRoute&&!previous){error("FOLLOWUP_CONTEXT_UNAVAILABLE");return;}
if(followupRoute&&details.kind!=="canonical")
 log("FOLLOWUP_SESSION_CONTEXT_RECOVERED");
var sid=followupRoute?details.sid:"sess_"+randomToken();
var skeleton=buildSyntheticSiriSkeleton(sid,followupRoute?"followup":"main");
if(!skeleton||
   !rewriteSse(skeleton,"AIES_PREFLIGHT","siri",
     followupRoute?"followup":"main",followupRoute?sid:null)){
 error("SYNTHETIC_SSE_PREFLIGHT_FAILED");return;
}
log("REQUEST_VALIDATED");
log("SYNTHETIC_SSE_PREFLIGHT_PASSED");
var key=storeRead(C.keyName);
if(!validKey(key)){error("KEY_NOT_PROVISIONED");return;}
if(!http||typeof http.post!=="function"){error("HTTP_CLIENT_UNAVAILABLE");return;}
if(typeof setTimeout==="function")
 timer=setTimeout(function(){error("MODEL_TIMEOUT");},C.timeoutMs);
log("DEEPSEEK_STARTED");
try{
 http.post({
  url:C.endpoint,method:"POST",timeout:14,"auto-redirect":false,
  headers:{"Content-Type":"application/json","Accept":"application/json",
    "Authorization":"Bearer "+key},
  body:safeJson({model:C.model,stream:false,thinking:{type:"disabled"},
   max_tokens:1000,messages:[
     {role:"system",content:
      "你是通过 AIES 转发的 DeepSeek 中文 Siri 问答助手。只回答用户问题，准确且清晰。"+
      "不自称千问；不要输出 JSON、代码围栏或重复来源前缀。"+
      "AIES 会在经过验证的回答前自动加【DeepSeek · AIES】。"}
    ].concat(previous,[{role:"user",content:prompt}])})
 },function(err,reply,bodyText){
  if(once)return;
  if(err){error("MODEL_NETWORK");return;}
  var answer=modelReply(reply,bodyText);
  if(!answer){error("MODEL_RESPONSE_INVALID");return;}
  var labeled=verifiedDeepSeekAnswerWithLabel(answer);
  if(!labeled){error("MODEL_RESPONSE_INVALID");return;}
  var result=rewriteSse(skeleton,labeled,"siri",
   followupRoute?"followup":"main",followupRoute?sid:null);
  if(!result){error("SYNTHETIC_SSE_REWRITE_FAILED");return;}
  if(!saveVerifiedHistory(result,prompt,answer,previous)){
   // Do not serve a non-continuable synthetic session.
   error("SESSION_STORE_UNAVAILABLE");return;
  }
  log("SIRI_CONTEXT_STORED");
  log("DEEPSEEK_LABEL_APPLIED");
  log("LOCAL_SSE_RESPONSE_READY");
  done({response:{status:200,headers:{
    "Content-Type":"text/event-stream; charset=utf-8",
    "Cache-Control":"no-store","X-AIES-Answer-Source":"deepseek"
   },body:result}});
 });
}catch(e){error("MODEL_EXCEPTION");}

})();
