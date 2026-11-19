/* Manual Script Test only. Clear Qwen passive probe state, not API Keys. */
"use strict";
(function(){
 var KEY="AIES_QWEN_PASSIVE_V1_STATE";
 var s=typeof $persistentStore!=="undefined"?$persistentStore:null;
 function log(v){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_QWEN_PASSIVE_LOCAL] "+v);}catch(e){}}
 if(!s||typeof s.read!=="function"||typeof s.write!=="function")log("STORE_UNAVAILABLE");
 else{
  var ok=false;try{ok=!!s.write("",KEY)&&!s.read(KEY);}catch(e){}
  log(ok?"STOPPED_AND_CLEARED":"STOP_FAILED");
 }
 if(typeof $done==="function")$done();
})();