/* AIES synthetic transport-failure probe. RESERVED .invalid host ONLY.
 * No model, key, Siri domain, request-body capture or upstream fallback.
 * throw/nodone modes are deliberate failure simulations; never use on real traffic.
 */
(function () {
  "use strict";
  var request=typeof $request==="undefined" ? null : $request;
  var done=typeof $done==="function" ? $done : null;
  var raw=request && typeof request.url==="string" ? request.url : "";
  var method=request && String(request.method || request.httpMethod || "").toUpperCase();
  var match=/^https:\/\/aies-probe\.invalid\/__aies_fault\?case=(ok|deny|throw|nodone)$/.exec(raw);
  function log(label) {
    if(typeof console!=="undefined" && console && typeof console.log==="function")
      console.log("[AIES_FAULT] "+label);
  }
  if (!done) { log("NO_DONE"); return; }
  if (!match || method!=="GET") {
    log("REQUEST_DENIED");
    done({response:{status:403,headers:{"Content-Type":"text/plain; charset=utf-8"},body:"AIES_FAULT_INVALID"}});
    return;
  }
  var mode=match[1];
  log("CASE_"+mode.toUpperCase());
  if(mode==="throw") { log("THROW_INTENTIONAL"); throw new Error("AIES_SYNTHETIC_THROW"); }
  if(mode==="nodone") { log("NO_DONE_INTENTIONAL"); return; }
  var ok=mode==="ok";
  log(ok ? "MOCK_ATTEMPTED" : "DENY_ATTEMPTED");
  done({response:{status:ok?200:503,headers:{
    "Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store",
    "X-AIES-Fault-Probe":"synthetic-only"
  },body:ok?"AIES_FAULT_OK":"AIES_FAULT_DENIED"}});
})();
