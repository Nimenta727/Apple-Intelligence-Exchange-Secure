/*
 * Manual Shadowrocket Script Test only. Never install as a network/event hook.
 * First run opens a 600s one-shot passive Qwen protocol observation.
 * Run again AFTER Siri finishes, to read bounded type-only results locally.
 * Reading erases the persistent snapshot first. No raw request/response text.
 */
"use strict";
(function(){
 var KEY="AIES_QWEN_PASSIVE_V1_STATE",TTL=600000;
 var store=typeof $persistentStore!=="undefined"?$persistentStore:null;
 function log(s){try{if(typeof console!=="undefined"&&console.log)console.log("[AIES_QWEN_PASSIVE_LOCAL] "+s);}catch(e){}}
 function done(){if(typeof $done==="function")$done();}
 if(!store||typeof store.read!=="function"||typeof store.write!=="function"){
  log("STORE_UNAVAILABLE");done();return;
 }
 function read(){try{return store.read(KEY)||"";}catch(e){return "";}}
 function write(v){try{return !!store.write(v,KEY);}catch(e){return false;}}
 function clear(){return write("")&&!read();}
 function emit(label,v){
  var raw=JSON.stringify(v);
  if(raw.length>26000){log(label+"_TOO_LARGE");return;}
  var size=380,n=Math.ceil(raw.length/size);
  log(label+"_PARTS="+n);
  for(var i=0;i<n;i++)log(label+"_PART_"+("00"+(i+1)).slice(-3)+"="+raw.slice(i*size,(i+1)*size));
 }
 var now=Date.now(),raw=read(),st=null;
 if(!raw){
  var val=JSON.stringify({v:1,phase:"armed",createdAt:now,expiresAt:now+TTL,request:null,response:null});
  if(write(val)&&read()===val){log("ARMED_600_SECONDS");log("PERSISTENCE_ROUNDTRIP_OK");}
  else log("ARM_FAILED");
  done();return;
 }
 try{st=JSON.parse(raw);}catch(e){}
 if(!st||st.v!==1||st.phase!=="armed"||
    typeof st.createdAt!=="number"||typeof st.expiresAt!=="number"||
    !isFinite(st.createdAt)||!isFinite(st.expiresAt)||
    st.createdAt>now||st.expiresAt<=st.createdAt||st.expiresAt>now+TTL+1000){
  log(clear()?"INVALID_STATE_CLEARED":"CLEAR_FAILED");done();return;
 }
 if(st.expiresAt<=now){
  log(clear()?"EXPIRED_CLEARED":"CLEAR_FAILED");done();return;
 }
 if(st.request===null&&st.response===null){
  log("ACTIVE_REMAINING_SECONDS="+Math.ceil((st.expiresAt-now)/1000));
  log("STILL_ARMED");done();return;
 }
 // Erase state before disclosing metadata. No Qwen prompt or answer values.
 if(!clear()){log("CLEAR_FAILED");done();return;}
 log("CAPTURED_LOCAL_PROTOCOL_SCHEMA");
 log("REQUEST_PRESENT="+(st.request!==null));
 log("RESPONSE_PRESENT="+(st.response!==null));
 if(st.request!==null)emit("REQUEST_SCHEMA",st.request);
 if(st.response!==null)emit("RESPONSE_SSE",st.response);
 log("CAPTURE_CLEARED");
 done();
})();