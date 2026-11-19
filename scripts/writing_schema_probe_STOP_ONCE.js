/* Manual only. Clears WritingTools schema probe, not any model key. */
(function(){
"use strict";
var KEY="AIES_WRITING_SCHEMA_V1",s=typeof $persistentStore!=="undefined"?$persistentStore:null;
function say(v){try{if(typeof console!=="undefined"&&console.log("[AIES_WRITING_SCHEMA_LOCAL] "+v);}catch(e){}}
if(!s||typeof s.read!=="function"||typeof s.write!=="function")say("STORE_UNAVAILABLE");
else{var ok=false;try{ok=!!s.write("",KEY)&&!s.read(KEY);}catch(e){}
say(ok?"STOPPED_AND_CLEARED":"STOP_FAILED");}
if(typeof $done==="function")$done();
})();