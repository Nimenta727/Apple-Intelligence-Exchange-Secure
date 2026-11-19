/*
 * LOCAL MANUAL SCRIPT TEST ONLY: explicitly stop/clear Siri group probe v2.
 * Does NOT touch the DeepSeek API Key. Never add as an automatic hook.
 */
"use strict";
(function(){
 var STATE="AIES_SIRI_GROUP_PROBE_V2_STATE",
  OLD_ARM="AIES_SIRI_GROUP_PROBE_ARM",OLD_RESULT="AIES_SIRI_GROUP_PROBE_RESULT";
 var store=typeof $persistentStore!=="undefined"?$persistentStore:null;
 function log(s){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_SIRI_GROUP_LOCAL] "+s);}catch(e){}}
 function done(){if(typeof $done==="function")$done();}
 if(!store||typeof store.write!=="function"||typeof store.read!=="function"){
  log("STORE_UNAVAILABLE");done();return;
 }
 function clear(k){try{return !!store.write("",k)&&!store.read(k);}catch(e){return false;}}
 // Clear all diagnostic versions, never their unrelated API Key.
 var ok=clear(STATE)&&clear(OLD_ARM)&&clear(OLD_RESULT);
 log(ok?"PROBE_STOPPED_AND_CLEARED":"PROBE_STOP_FAILED");
 done();
})();