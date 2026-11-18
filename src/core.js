"use strict";
var C=require("./config");
var Request=require("./request");
var Provider=require("./deepseek");
var Sse=require("./sse");

function run(runtime) {
  var done=runtime && runtime.done;
  // If the proxy cannot produce a synthetic response, do not call the model.
  // Independent REJECT rule is still required on the device.
  if (typeof done!=="function") return {started:false,reason:"NO_MOCK_INTERFACE"};
  var finished=false, timerId=null;
  function finish(status,body,mime) {
    if (finished) return;
    finished=true;
    if (timerId!==null && runtime.clearTimeout) {
      try { runtime.clearTimeout(timerId); } catch(e) {}
    }
    try {
      done({response:{status:status,headers:{
        "Content-Type":mime || "application/json; charset=utf-8",
        "Cache-Control":"no-store, no-cache, must-revalidate",
        "X-AIES-Lab":C.version
      },body:body}});
    } catch(e) {
      // No unsafe $done({}) fallback.
    }
  }
  function fail(status,code) {
    // Stable error codes only; no API keys, user prompts or upstream bodies.
    finish(status,JSON.stringify({error:"AIES_"+code}),"application/json; charset=utf-8");
  }
  try {
    var parsed=Request.parseBody(runtime.request);
    if (!parsed.ok) {fail(422,parsed.code);return {started:false,reason:parsed.code};}
    var store=runtime.store;
    var key=store && typeof store.read==="function" ? store.read(C.keyName) : "";
    if (typeof key!=="string" ||
        !/^[A-Za-z0-9_-]{12,256}$/.test(key) ||
        /REPLACE_WITH|PLACEHOLDER/i.test(key)) {
      fail(503,"KEY_NOT_PROVISIONED");return {started:false,reason:"KEY_NOT_PROVISIONED"};
    }
    if (!runtime.httpClient || typeof runtime.httpClient.post!=="function") {
      fail(503,"HTTP_CLIENT_MISSING");return {started:false,reason:"HTTP_CLIENT_MISSING"};
    }
    if (typeof runtime.setTimeout==="function") {
      timerId=runtime.setTimeout(function(){fail(504,"UPSTREAM_TIMEOUT");},C.safetyTimeoutMillis);
    }
    Provider.callDeepSeek(runtime.httpClient,key.trim(),parsed,function(error,answer){
      if (finished) return;
      if (error) {fail(502,error.code || "UPSTREAM_FAILURE");return;}
      try {
        var sse=Sse.candidateSse(answer,parsed.prompt,parsed.scenario,runtime.clock);
        finish(200,sse,"text/event-stream; charset=utf-8");
      } catch(e) {fail(502,"SSE_BUILD_FAILED");}
    });
    return {started:true};
  } catch(e) {
    fail(500,"INTERNAL_ERROR");
    return {started:false,reason:"INTERNAL_ERROR"};
  }
}
module.exports={run:run};
