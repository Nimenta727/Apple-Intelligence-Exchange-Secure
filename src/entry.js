"use strict";
var Core=require("./core");
// Shadowrocket globals are injected by the proxy runtime. Never access
// undefined globals without typeof guards.
Core.run({
  trace:function(stage){
    // Deliberately no raw request details; script execution is not the same as network REJECT.
    if (typeof console!=="undefined" && console && typeof console.log==="function")
      console.log("[AIES_DIAG] "+stage);
  },
  request:typeof $request!=="undefined" ? $request : null,
  done:typeof $done==="function" ? $done : null,
  store:typeof $persistentStore!=="undefined" ? $persistentStore : null,
  httpClient:typeof $httpClient!=="undefined" ? $httpClient : null,
  setTimeout:typeof setTimeout==="function" ? setTimeout : null,
  clearTimeout:typeof clearTimeout==="function" ? clearTimeout : null
});
