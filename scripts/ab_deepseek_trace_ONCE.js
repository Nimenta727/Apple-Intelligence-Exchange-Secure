/*
 * Shadowrocket MANUAL Script Test only. 10-minute one-shot DeepSeek-side
 * A/B diagnostic. Never install as HTTP/event/cron script.
 * May print a redacted extract of the controlled test answer. Use an entirely
 * NON-PRIVATE test question; inspect this local result before sharing.
 * First run ARMS, second run after Siri finishes READS and CLEARS.
 */
(function(){
"use strict";
var KEY="AIES_AB_DEEPSEEK_V1_STATE",TTL=600000;
var store=typeof $persistentStore!=="undefined"?$persistentStore:null;
function say(s){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_AB_DEEPSEEK_LOCAL] "+s);}catch(e){}}
function done(){if(typeof $done==="function")$done();}
if(!store||typeof store.read!=="function"||typeof store.write!=="function"){
 say("STORE_UNAVAILABLE");done();return;
}
function read(){try{return store.read(KEY)||"";}catch(e){return "";}}
function write(v){try{return !!store.write(v,KEY);}catch(e){return false;}}
function clear(){return write("")&&!read();}
var now=Date.now(),raw=read(),state=null;
if(!raw){
 var armed=JSON.stringify({v:1,phase:"armed",createdAt:now,expiresAt:now+TTL,events:[]});
 if(write(armed)&&read()===armed){
  say("ARMED_600_SECONDS");say("PERSISTENCE_ROUNDTRIP_OK");
 }else say("ARM_FAILED");
 done();return;
}
try{state=JSON.parse(raw);}catch(e){}
if(!state||state.v!==1||state.phase!=="armed"||
 typeof state.expiresAt!=="number"||typeof state.createdAt!=="number"||
 !Array.isArray(state.events)||state.createdAt>now||
 state.expiresAt<=state.createdAt||state.expiresAt>now+TTL+1000){
 say(clear()?"INVALID_STATE_CLEARED":"CLEAR_FAILED");done();return;
}
if(state.expiresAt<=now){
 say(clear()?"EXPIRED_CLEARED":"CLEAR_FAILED");done();return;
}
if(state.events.length===0){
 say("ACTIVE_REMAINING_SECONDS="+Math.ceil((state.expiresAt-now)/1000));
 say("STILL_ARMED");done();return;
}
var dump=JSON.stringify({mode:"deepseek",durationMs:now-state.createdAt,
 eventCount:state.events.length,events:state.events});
if(dump.length>49000){say("REPORT_OVERSIZE");done();return;}
// Erase before showing data. This is logical clearance, not a disk wipe.
if(!clear()){say("CLEAR_FAILED");done();return;}
say("CAPTURED_LOCAL_READOUT");
say("EVENTS="+state.events.length);
say("CONTENT_NOTICE=ONLY_USE_A_NONPRIVATE_TEST_QUESTION");
var size=380,n=Math.ceil(dump.length/size);
say("TRACE_PARTS="+n);
for(var i=0;i<n;i++)
 say("TRACE_PART_"+("00"+(i+1)).slice(-3)+"="+dump.slice(i*size,(i+1)*size));
say("CAPTURE_CLEARED");
done();
})();