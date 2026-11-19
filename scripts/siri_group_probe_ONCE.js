/*
 * LOCAL MANUAL SCRIPT TEST ONLY — Siri group probe v2.
 * First run: arm for 600 seconds. Later runs: STATUS ONLY (never toggle off).
 * After capture: show the bounded group ID once locally, then clear the result.
 * For manual cancellation, run siri_group_probe_STOP_ONCE.js separately.
 * No network, API Key, prompts, headers or HTTP bodies are accessed.
 * Do NOT schedule this helper as an http-request/event/cron hook.
 */
"use strict";
(function(){
 var STATE="AIES_SIRI_GROUP_PROBE_V2_STATE",
  OLD_ARM="AIES_SIRI_GROUP_PROBE_ARM",
  OLD_RESULT="AIES_SIRI_GROUP_PROBE_RESULT",WINDOW=600000;
 var store=typeof $persistentStore!=="undefined"?$persistentStore:null;
 function log(s){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_SIRI_GROUP_LOCAL] "+s);}catch(e){}}
 function done(){if(typeof $done==="function")$done();}
 if(!store||typeof store.read!=="function"||typeof store.write!=="function"){
  log("STORE_UNAVAILABLE");done();return;
 }
 function read(k){try{return store.read(k)||"";}catch(e){return "";}}
 function write(k,v){try{return !!store.write(v,k);}catch(e){return false;}}
 function parse(t){try{return JSON.parse(t);}catch(e){return null;}}
 function safeId(v){
  return typeof v==="string"&&v.length>=2&&v.length<=80&&
   /^[A-Za-z][A-Za-z0-9_.-]*$/.test(v)&&
   !/[A-Za-z0-9]{25,}/.test(v)&&
   !/^(?:bearer|token|secret|sk-)/i.test(v);
 }
 function count(n){return typeof n==="number"&&n>=0&&n<=9&&Math.floor(n)===n?n:0;}
 function clear(){
  if(!write(STATE,"")||read(STATE)!==""){log("CLEAR_FAILED");return false;}
  return true;
 }
 function report(st){
  log("SIRI_REQUESTS_SEEN="+count(st.siriSeen));
  log("WRITINGTOOLS_SEEN="+count(st.writingToolsSeen));
  log("OTHER_CLIENTS_SEEN="+count(st.otherClientSeen));
  // An explicit fixed-code allowlist guards against unexpected stored content.
  var stages=[
   "NONE","OK","BODY_NOT_TEXT","BODY_EMPTY","BODY_OVERSIZE",
   "JSON_INVALID","ROOT_UNSUPPORTED","GROUP_MISSING","GROUP_UNSUPPORTED",
   "INPUT_UNSUPPORTED","CONTENT_UNSUPPORTED","MEDIA_UNSUPPORTED",
   "PROMPT_EMPTY","PROMPT_OVERSIZE","STRUCTURE_UNSUPPORTED",
   "GROUP_CAPTURED","GROUP_ID_UNSAFE","UNKNOWN_STAGE"
  ];
  log("LAST_STAGE="+(stages.indexOf(st.lastCode)>=0?st.lastCode:"UNKNOWN_STAGE"));
 }
 // Discard v1's unbounded transitional keys, but never expose their values.
 if(read(OLD_ARM))write(OLD_ARM,"");
 if(read(OLD_RESULT))write(OLD_RESULT,"");
 var now=Date.now(),raw=read(STATE);
 if(!raw){
  var state={v:2,phase:"armed",createdAt:now,expiresAt:now+WINDOW,
   siriSeen:0,writingToolsSeen:0,otherClientSeen:0,lastCode:"NONE"};
  var encoded=JSON.stringify(state);
  if(write(STATE,encoded)&&read(STATE)===encoded){
   log("ARMED_600_SECONDS");
   log("PERSISTENCE_ROUNDTRIP_OK");
  }else log("PERSISTENCE_ROUNDTRIP_FAILED");
  done();return;
 }
 var st=parse(raw);
 if(!st||st.v!==2||!(st.phase==="armed"||st.phase==="captured")||
    typeof st.expiresAt!=="number"||!isFinite(st.expiresAt)||
    typeof st.createdAt!=="number"||!isFinite(st.createdAt)||
    st.expiresAt<=st.createdAt||st.expiresAt>now+WINDOW){
  if(clear())log("INVALID_OR_EXPIRED_STATE_CLEARED");
  done();return;
 }
 if(st.expiresAt<=now){
  report(st);
  if(clear())log(st.phase==="captured"?"CAPTURE_EXPIRED_CLEARED":"EXPIRED_CLEARED");
  done();return;
 }
 if(st.phase==="armed"){
  log("ACTIVE_REMAINING_SECONDS="+Math.ceil((st.expiresAt-now)/1000));
  report(st);
  log("STILL_ARMED");
  done();return;
 }
 // A captured ID is revealed only by deliberately running Script Test.
 // Erase first; never display if the logical erase failed.
 var id=st.groupId;
 if(!clear()){done();return;}
 report(st);
 if(safeId(id))log("GROUP_ID="+id);
 else log("CAPTURE_UNSAFE_CLEARED");
 done();
})();