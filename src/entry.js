"use strict";
var Core=require("./core");
// Shadowrocket globals are injected by the proxy runtime. Never access
// undefined globals without typeof guards.
Core.run({
  request:typeof $request!=="undefined" ? $request : null,
  done:typeof $done==="function" ? $done : null,
  store:typeof $persistentStore!=="undefined" ? $persistentStore : null,
  httpClient:typeof $httpClient!=="undefined" ? $httpClient : null,
  setTimeout:typeof setTimeout==="function" ? setTimeout : null,
  clearTimeout:typeof clearTimeout==="function" ? clearTimeout : null
});
