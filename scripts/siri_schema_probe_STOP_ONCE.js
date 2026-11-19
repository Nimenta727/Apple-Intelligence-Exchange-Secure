/*
 * LOCAL MANUAL SCRIPT TEST ONLY: cancel noRTI schema-key/type capture.
 * Clears only the schema probe state; does not touch the DeepSeek API Key.
 */
"use strict";
(function(){
 var STATE="AIES_NORTI_SCHEMA_PROBE_V1_STATE";
 var store=typeof $persistentStore!=="undefined"?$persistentStore:null;
 function log(s){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_SIRI_SCHEMA_LOCAL] "+s);}catch(e){}}
 function done(){if(typeof $done==="function")$done();}
 if(!store||typeof store.read!=="function"||typeof store.write!=="function"){
  log("STORE_UNAVAILABLE");done();return;
 }
 var success=false;
 try{success=!!store.write("",STATE)&&!store.read(STATE);}catch(e){}
 log(success?"SCHEMA_PROBE_STOPPED_AND_CLEARED":"STOP_FAILED");
 done();
})();