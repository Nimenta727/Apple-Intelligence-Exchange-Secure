/*
 * LOCAL SCRIPT TEST ONLY: cancel/clear one-shot Siri->Qwen request-body probe.
 * Does not touch the API Key, VPN, MITM, or other diagnostic scripts.
 */
"use strict";
(function(){
 var STATE="AIES_QWEN_BODY_PROBE_V1_STATE";
 var store=typeof $persistentStore!=="undefined"?$persistentStore:null;
 function log(s){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_QWEN_BODY_LOCAL] "+s);}catch(e){}}
 function done(){if(typeof $done==="function")$done();}
 if(!store||typeof store.read!=="function"||typeof store.write!=="function"){
  log("STORE_UNAVAILABLE");done();return;
 }
 var ok=false;try{ok=!!store.write("",STATE)&&!store.read(STATE);}catch(e){}
 log(ok?"CAPTURE_STOPPED_AND_CLEARED":"STOP_FAILED");
 done();
})();