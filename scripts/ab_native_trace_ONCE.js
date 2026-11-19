/*
 * Manual Shadowrocket Script Test. Native-Qwen A/B arm/read, NOT a network
 * hook. User must choose a non-private Siri question. Qwen answer text MAY
 * appear in the LOCAL readout. Review it before sharing.
 */
(function(){
"use strict";
var KEY="AIES_AB_NATIVE_V1_STATE",TTL=600000;
var store=typeof $persistentStore!=="undefined"?$persistentStore:null;
function say(s){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_AB_NATIVE_LOCAL] "+s);}catch(e){}}
function done(){if(typeof $done==="function")$done();}
if(!store||typeof store.read!=="function"||typeof store.write!=="function"){
 say("STORE_UNAVAILABLE");done();return;
}
function read(){try{return store.read(KEY)||"";}catch(e){return "";}}
function write(v){try{return !!store.write(v,KEY);}catch(e){return false;}}
function clear(){return write("")&&!read();}
var now=Date.now(),raw=read(),st=null;
if(!raw){
 var armed=JSON.stringify({v:1,phase:"armed",createdAt:now,expiresAt:now+TTL,records:[]});
 if(write(armed)&&read()===armed){say("ARMED_600_SECONDS");say("PERSISTENCE_ROUNDTRIP_OK");}
 else say("ARM_FAILED");
 done();return;
}
try{st=JSON.parse(raw);}catch(e){}
if(!st||st.v!==1||st.phase!=="armed"||!Array.isArray(st.records)||
 typeof st.createdAt!=="number"||typeof st.expiresAt!=="number"||
 st.createdAt>now||st.expiresAt<=st.createdAt||st.expiresAt>now+TTL+1000){
 say(clear()?"INVALID_STATE_CLEARED":"CLEAR_FAILED");done();return;
}
if(st.expiresAt<=now){say(clear()?"EXPIRED_CLEARED":"CLEAR_FAILED");done();return;}
if(st.records.length===0){
 say("ACTIVE_REMAINING_SECONDS="+Math.ceil((st.expiresAt-now)/1000));
 say("STILL_ARMED");done();return;
}
var dump=JSON.stringify({mode:"native_qwen",durationMs:now-st.createdAt,
 recordsCount:st.records.length,records:st.records});
if(dump.length>49000){say("REPORT_OVERSIZE");done();return;}
if(!clear()){say("CLEAR_FAILED");done();return;}
say("CAPTURED_LOCAL_READOUT");say("RECORDS="+st.records.length);
say("CONTENT_NOTICE=ONLY_USE_A_NONPRIVATE_TEST_QUESTION");
var n=Math.ceil(dump.length/380);say("TRACE_PARTS="+n);
for(var i=0;i<n;i++)say("TRACE_PART_"+("00"+(i+1)).slice(-3)+"="+dump.slice(i*380,(i+1)*380));
say("CAPTURE_CLEARED");done();
})();