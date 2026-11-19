/* Manual Script Test only; clear native-Qwen A/B state, not API Key. */
(function(){
"use strict";
var KEY="AIES_AB_NATIVE_V1_STATE",s=typeof $persistentStore!=="undefined"?$persistentStore:null;
function say(x){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_AB_NATIVE_LOCAL] "+x);}catch(e){}}
if(!s||!s.read||!s.write)say("STORE_UNAVAILABLE");
else{var ok=false;try{ok=!!s.write("",KEY)&&!s.read(KEY);}catch(e){}say(ok?"STOPPED_AND_CLEARED":"STOP_FAILED");}
if(typeof $done==="function")$done();
})();