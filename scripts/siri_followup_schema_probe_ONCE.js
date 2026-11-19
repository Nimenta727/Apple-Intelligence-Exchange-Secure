/*
 * Run MANUALLY with Shadowrocket Script Test, never as an HTTP/event/cron hook.
 * First run: arm a 600s Siri session-followup shape-only capture on passive module 61.
 * Second run after two nonprivate Siri turns: read, print, logically clear.
 * Captures independent request field/type and SSE event/type summaries (no pairing assumed).
 * NO prompts, answers, URLs, session IDs, raw SSE, headers, cookies or API Key.
 */
(function(){
"use strict";
var KEY="AIES_SIRI_FOLLOWUP_SCHEMA_V1",TTL=600000;
var store=typeof $persistentStore!=="undefined"?$persistentStore:null;
function say(s){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_SIRI_FOLLOWUP_SCHEMA_LOCAL] "+s);}catch(e){}}
function done(){if(typeof $done==="function")$done();}
if(!store||typeof store.read!=="function"||typeof store.write!=="function"){
 say("STORE_UNAVAILABLE");done();return;
}
function read(){try{return store.read(KEY)||"";}catch(e){return "";}}
function write(v){try{return !!store.write(v,KEY);}catch(e){return false;}}
function clear(){return write("")&&!read();}
var now=Date.now(),raw=read(),state=null;
if(!raw){
 var armed=JSON.stringify({v:1,phase:"armed",createdAt:now,expiresAt:now+TTL,records:[]});
 if(write(armed)&&read()===armed){
  say("ARMED_600_SECONDS");say("PERSISTENCE_ROUNDTRIP_OK");
 }else say("ARM_FAILED");
 done();return;
}
try{state=JSON.parse(raw);}catch(e){}
if(!state||state.v!==1||state.phase!=="armed"||
 typeof state.createdAt!=="number"||typeof state.expiresAt!=="number"||
 !Array.isArray(state.records)||state.createdAt>now||
 state.expiresAt<=state.createdAt||state.expiresAt>now+TTL+1000){
 say(clear()?"INVALID_STATE_CLEARED":"CLEAR_FAILED");done();return;
}
if(state.expiresAt<=now){say(clear()?"EXPIRED_CLEARED":"CLEAR_FAILED");done();return;}
if(!state.records.length){
 say("ACTIVE_REMAINING_SECONDS="+Math.ceil((state.expiresAt-now)/1000));
 say("STILL_ARMED");done();return;
}
var out=JSON.stringify({mode:"siri_followup_schema_only",durationMs:now-state.createdAt,
 recordCount:state.records.length,records:state.records});
if(out.length>49000){say("REPORT_OVERSIZE");done();return;}
if(!clear()){say("CLEAR_FAILED");done();return;}
say("CAPTURED_LOCAL_PROTOCOL_SCHEMA");
say("RECORDS="+state.records.length);
var n=Math.ceil(out.length/380);say("TRACE_PARTS="+n);
for(var i=0;i<n;i++)say("TRACE_PART_"+("00"+(i+1)).slice(-3)+"="+out.slice(i*380,(i+1)*380));
say("CAPTURE_CLEARED");done();
})();