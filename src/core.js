"use strict";
var C=require("./config");
var Request=require("./request");
var Provider=require("./deepseek");
var Sse=require("./sse");

function run(runtime) {
  var done=runtime && runtime.done;
  function trace(stage) {
    // Fixed stage identifiers only. Never log the URL, headers, key, request body, or answer.
    if (!C.diagnosticsEnabled || !runtime || typeof runtime.trace!=="function") return;
    try { runtime.trace(stage); } catch (e) {}
  }
  trace("ENTER");
  // If the proxy cannot produce a synthetic response, do not call the model.
  // Independent REJECT rule is still required on the device.
  if (typeof done!=="function") {trace("NO_MOCK_INTERFACE");return {started:false,reason:"NO_MOCK_INTERFACE"};}
  var finished=false, timerId=null;
  function finish(status,body,mime) {
    if (finished) return;
    finished=true;
    if (timerId!==null && runtime.clearTimeout) {
      try { runtime.clearTimeout(timerId); } catch(e) {}
    }
    trace(status===200 ? "LOCAL_RESPONSE_ATTEMPTED" : "LOCAL_ERROR_ATTEMPTED");
    try {
      done({response:{status:status,headers:{
        "Content-Type":mime || "application/json; charset=utf-8",
        "Cache-Control":"no-store, no-cache, must-revalidate",
        "X-AIES-Lab":C.version
      },body:body}});
    } catch(e) {
      trace("DONE_THROW");
      // No unsafe $done({}) fallback.
    }
  }
  function fail(status,code) {
    // Stable error codes only; no API keys, user prompts or upstream bodies.
    finish(status,JSON.stringify({error:"AIES_"+code}),"application/json; charset=utf-8");
  }
  try {
    var parsed=Request.parseBody(runtime.request);
    if (!parsed.ok) {trace("REQUEST_REJECTED");fail(422,parsed.code);return {started:false,reason:parsed.code};}
    trace("REQUEST_VALIDATED");
    // A JS-only fail-closed response is NOT proof that the original connection
    // cannot reach the upstream provider. No real prompt may leave this lab
    // while the network-boundary deployment remains unverified.
    if (!C.providerEnabled) {
      trace("NETWORK_ISOLATION_UNVERIFIED");
      fail(503,"NETWORK_ISOLATION_UNVERIFIED");
      return {started:false,reason:"NETWORK_ISOLATION_UNVERIFIED"};
    }
    var store=runtime.store;
    var key=store && typeof store.read==="function" ? store.read(C.keyName) : "";
    if (typeof key!=="string" ||
        !/^[A-Za-z0-9_-]{12,256}$/.test(key) ||
        /REPLACE_WITH|PLACEHOLDER/i.test(key)) {
      trace("KEY_MISSING");
      fail(503,"KEY_NOT_PROVISIONED");return {started:false,reason:"KEY_NOT_PROVISIONED"};
    }
    if (!runtime.httpClient || typeof runtime.httpClient.post!=="function") {
      trace("HTTP_CLIENT_MISSING");
      fail(503,"HTTP_CLIENT_MISSING");return {started:false,reason:"HTTP_CLIENT_MISSING"};
    }
    if (typeof runtime.setTimeout==="function") {
      timerId=runtime.setTimeout(function(){trace("UPSTREAM_TIMEOUT");fail(504,"UPSTREAM_TIMEOUT");},C.safetyTimeoutMillis);
    }
    trace("UPSTREAM_STARTED");
    Provider.callDeepSeek(runtime.httpClient,key.trim(),parsed,function(error,answer){
      if (finished) return;
      if (error) {trace("UPSTREAM_FAILED");fail(502,error.code || "UPSTREAM_FAILURE");return;}
      trace("UPSTREAM_OK");
      try {
        var sse=Sse.candidateSse(answer,parsed.prompt,parsed.scenario,runtime.clock);
        finish(200,sse,"text/event-stream; charset=utf-8");
      } catch(e) {fail(502,"SSE_BUILD_FAILED");}
    });
    return {started:true};
  } catch(e) {
    trace("INTERNAL_ERROR");
    fail(500,"INTERNAL_ERROR");
    return {started:false,reason:"INTERNAL_ERROR"};
  }
}
module.exports={run:run};
