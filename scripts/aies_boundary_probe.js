/* AIES local-only synthetic transport probe.
 * No Siri host, no model calls, no API key, no upstream fallback.
 */
(function () {
  "use strict";
  var req=typeof $request==="undefined" ? null : $request;
  var done=typeof $done==="function" ? $done : null;
  if (!done) return;
  var url=req && typeof req.url==="string" ? req.url : "";
  var method=req && String(req.method || req.httpMethod || "").toUpperCase();
  var match=/^https:\/\/aies-probe\.invalid\/__aies_probe(?:\?[A-Za-z0-9_=&-]{0,128})?$/.test(url);
  var ok=match && method==="GET";
  // Only fixed labels; do not log URL, headers or request body.
  if (typeof console!=="undefined" && console && typeof console.log==="function")
    console.log(ok ? "[AIES_BOUNDARY] MOCK_ATTEMPTED" : "[AIES_BOUNDARY] REQUEST_DENIED");
  done({response:{
    status:ok ? 200 : 403,
    headers:{
      "Content-Type":"text/plain; charset=utf-8",
      "Cache-Control":"no-store",
      "X-AIES-Boundary-Probe":"synthetic-only"
    },
    body:ok ? "AIES_BOUNDARY_PROBE_OK" : "AIES_BOUNDARY_PROBE_DENIED"
  }});
})();
