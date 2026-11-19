/*
 * LOCAL MANUAL SCRIPT TEST ONLY: noRTI schema metadata probe.
 * First run arms 600 seconds; further runs show status without disarming.
 * A matching Siri POST whose strict text-only shape is unsupported saves only
 * bounded, screened FIELD NAMES and TYPES, never values, prompts or headers.
 * Reading the result clears it first. Not an HTTP/event/cron automatic hook.
 */
"use strict";
(function(){
 var STATE="AIES_NORTI_SCHEMA_PROBE_V1_STATE",TTL=600000;
 var store=typeof $persistentStore!=="undefined"?$persistentStore:null;
 function log(s){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_SIRI_SCHEMA_LOCAL] "+s);}catch(e){}}
 function done(){if(typeof $done==="function")$done();}
 if(!store||typeof store.read!=="function"||typeof store.write!=="function"){
  log("STORE_UNAVAILABLE");done();return;
 }
 function read(k){try{return store.read(k)||"";}catch(e){return "";}}
 function write(k,v){try{return !!store.write(v,k);}catch(e){return false;}}
 function clear(){return write(STATE,"")&&!read(STATE);}
 function validName(k){
  return k==="REDACTED"||k==="TRUNCATED"||
   typeof k==="string"&&k.length>0&&k.length<=40&&
   /^[A-Za-z_][A-Za-z0-9_-]*$/.test(k)&&!/[A-Za-z0-9]{22,}/.test(k)&&
   !/(?:secret|token|auth|bearer|cookie|passwd|password|private|credential|api.?key|session|account|user|email|phone|address|location|uuid|identifier)/i.test(k);
 }
 function entries(a){
  if(!Array.isArray(a)||a.length>9)return "INVALID";
  var out=[];
  for(var i=0;i<a.length;i++){
   var v=a[i];
   if(!v||typeof v!=="object"||!validName(v.name)||
      ["null","array","object","string","number","boolean","other"].indexOf(v.type)<0)return "INVALID";
   out.push(v.name+":"+v.type);
  }
  return out.length?out.join(","):"NONE";
 }
 var now=Date.now(),raw=read(STATE);
 if(!raw){
  var state={v:1,phase:"armed",createdAt:now,expiresAt:now+TTL};
  var encoded=JSON.stringify(state);
  if(write(STATE,encoded)&&read(STATE)===encoded){
   log("ARMED_600_SECONDS");
   log("PERSISTENCE_ROUNDTRIP_OK");
  }else log("PERSISTENCE_ROUNDTRIP_FAILED");
  done();return;
 }
 var state=null;
 try{state=JSON.parse(raw);}catch(e){}
 if(!state||state.v!==1||!(state.phase==="armed"||state.phase==="captured")||
    typeof state.createdAt!=="number"||typeof state.expiresAt!=="number"||
    !isFinite(state.createdAt)||!isFinite(state.expiresAt)||
    state.createdAt>now||state.expiresAt<=state.createdAt||
    state.expiresAt>now+TTL){
  if(clear())log("INVALID_STATE_CLEARED");else log("CLEAR_FAILED");
  done();return;
 }
 if(state.expiresAt<=now){
  if(clear())log("EXPIRED_CLEARED");else log("CLEAR_FAILED");
  done();return;
 }
 if(state.phase==="armed"){
  log("ACTIVE_REMAINING_SECONDS="+Math.ceil((state.expiresAt-now)/1000));
  log("STILL_ARMED");
  done();return;
 }
 // Erase BEFORE showing bounded local metadata; no user content is shown.
 if(!clear()){log("CLEAR_FAILED");done();return;}
 if(["null","array","object","string","number","boolean","other"].indexOf(state.inputType)<0){
  log("CAPTURE_INVALID_CLEARED");done();return;
 }
 var root=entries(state.root),wrapper=entries(state.wrapper),message=entries(state.message);
 if(root==="INVALID"||wrapper==="INVALID"||message==="INVALID"){
  log("CAPTURE_INVALID_CLEARED");done();return;
 }
 log("SCHEMA_CAPTURED");
 log("INPUT_TYPE="+state.inputType);
 log("ROOT_EXTRA_FIELDS="+root);
 log("ITEM_WRAPPER_EXTRA_FIELDS="+wrapper);
 log("MESSAGE_FIELD_TYPES="+message);
 log("SCHEMA_CLEARED");
 done();
})();