/* Manual Script Test only. Stops the A/B DeepSeek trace, NOT the API Key. */
(function(){
"use strict";
var KEY="AIES_AB_DEEPSEEK_V1_STATE",s=typeof $persistentStore!=="undefined"?$persistentStore:null;
function say(v){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_AB_DEEPSEEK_LOCAL] "+v);}catch(e){}}
if(!s||typeof s.read!=="function"||typeof s.write!=="function")say("STORE_UNAVAILABLE");
else{var ok=false;try{ok=!!s.write("",KEY)&&!s.read(KEY);}catch(e){}
say(ok?"STOPPED_AND_CLEARED":"STOP_FAILED");}
if(typeof $done==="function")$done();
})();