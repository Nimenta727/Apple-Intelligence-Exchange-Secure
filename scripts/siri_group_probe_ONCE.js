/*
 * LOCAL MANUAL SCRIPT TEST ONLY. Run once to arm a 3-minute, one-shot
 * Siri GROUP_UNSUPPORTED probe; run again to inspect and erase the result.
 * No API Key, request body, token, or network traffic is read or printed.
 * Do not add this helper as an http-request/event/cron hook.
 */
"use strict";
(function(){
 var ARM="AIES_SIRI_GROUP_PROBE_ARM",RESULT="AIES_SIRI_GROUP_PROBE_RESULT";
 var store=typeof $persistentStore!=="undefined"?$persistentStore:null;
 function log(s){if(typeof console!=="undefined"&&console.log)console.log("[AIES_SIRI_GROUP_LOCAL] "+s);}
 function done(){if(typeof $done==="function")$done();}
 if(!store||typeof store.read!=="function"||typeof store.write!=="function"){
  log("STORE_UNAVAILABLE");done();return;
 }
 function get(k){try{return store.read(k)||"";}catch(e){return "";}}
 function put(k,v){try{return !!store.write(v,k);}catch(e){return false;}}
 function unpack(s){try{return JSON.parse(s);}catch(e){return null;}}
 function safeId(v){
  return typeof v==="string"&&v.length>=2&&v.length<=80&&
   /^[A-Za-z][A-Za-z0-9_.-]*$/.test(v)&&
   !/[A-Za-z0-9]{25,}/.test(v)&&
   !/^(?:bearer|token|secret|sk-)/i.test(v);
 }
 var resultRaw=get(RESULT),armRaw=get(ARM),result=unpack(resultRaw),arm=unpack(armRaw);
 var now=Date.now();
 if(resultRaw){
  put(RESULT,"");put(ARM,"");
  if(result&&typeof result.expiresAt==="number"&&result.expiresAt>now&&
     result.expiresAt<=now+180000&&safeId(result.id)){
   // Deliberately revealed only by local manual Script Test.
   log("GROUP_ID="+result.id);
  }else log("NO_SAFE_RESULT_OR_EXPIRED");
 }else if(armRaw){
  put(ARM,"");put(RESULT,"");
  log("NO_CAPTURE_PROBE_DISARMED");
 }else{
  put(RESULT,"");
  if(put(ARM,JSON.stringify({expiresAt:now+180000})))log("ARMED_180_SECONDS");
  else log("STORE_WRITE_FAILED");
 }
 done();
})();