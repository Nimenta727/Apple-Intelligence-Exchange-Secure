/*
 * LOCAL SCRIPT TEST ONLY. First run arms a one-shot 600-second capture;
 * later runs show status or print locally redacted Siri->Qwen JSON segments.
 * This is NOT an HTTP, cron or event hook. Does not inspect HTTP headers.
 * WARNING: even a sanitized snapshot may contain YOUR Siri test question.
 * Use a nonsensitive test question. Do not upload full PacketTunnel logs.
 */
"use strict";
(function(){
 var STATE="AIES_QWEN_BODY_PROBE_V1_STATE",TTL=600000;
 var store=typeof $persistentStore!=="undefined"?$persistentStore:null;
 function log(s){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_QWEN_BODY_LOCAL] "+s);}catch(e){}}
 function done(){if(typeof $done==="function")$done();}
 function read(){try{return store.read(STATE)||"";}catch(e){return "";}}
 function write(v){try{return !!store.write(v,STATE);}catch(e){return false;}}
 function clear(){return write("")&&!read();}
 if(!store||typeof store.read!=="function"||typeof store.write!=="function"){
  log("STORE_UNAVAILABLE");done();return;
 }
 var now=Date.now(),raw=read();
 if(!raw){
  var st={v:1,phase:"armed",createdAt:now,expiresAt:now+TTL};
  var encoded=JSON.stringify(st);
  if(write(encoded)&&read()===encoded){
   log("ARMED_600_SECONDS");
   log("PERSISTENCE_ROUNDTRIP_OK");
  }else log("PERSISTENCE_ROUNDTRIP_FAILED");
  done();return;
 }
 var state=null;
 try{state=JSON.parse(raw);}catch(e){}
 if(!state||state.v!==1||!(state.phase==="armed"||state.phase==="captured")||
    typeof state.createdAt!=="number"||typeof state.expiresAt!=="number"||
    !isFinite(state.createdAt)||!isFinite(state.expiresAt)||
    state.createdAt>now||state.expiresAt<=state.createdAt||
    state.expiresAt>now+TTL){
  log(clear()?"INVALID_STATE_CLEARED":"CLEAR_FAILED");done();return;
 }
 if(state.expiresAt<=now){
  log(clear()?"EXPIRED_CLEARED":"CLEAR_FAILED");done();return;
 }
 if(state.phase==="armed"){
  log("ACTIVE_REMAINING_SECONDS="+Math.ceil((state.expiresAt-now)/1000));
  log("STILL_ARMED");done();return;
 }
 var body=state.body;
 if(typeof body!=="string"||body.length>18000||body.length===0){
  log(clear()?"CAPTURE_INVALID_CLEARED":"CLEAR_FAILED");done();return;
 }
 // Ensure captured content is valid JSON before displaying it to the local user.
 try{JSON.parse(body);}catch(e){log(clear()?"CAPTURE_INVALID_CLEARED":"CLEAR_FAILED");done();return;}
 if(!clear()){log("CLEAR_FAILED");done();return;}
 var chunk=420,total=Math.ceil(body.length/chunk);
 log("BODY_CAPTURED_REDACTED_JSON");
 log("BODY_PARTS="+total);
 for(var i=0;i<total;i++){
  var idx=("00"+(i+1)).slice(-3);
  log("BODY_PART_"+idx+"="+body.slice(i*chunk,(i+1)*chunk));
 }
 log("CAPTURE_CLEARED");
 done();
})();