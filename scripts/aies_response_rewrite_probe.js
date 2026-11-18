/* AIES P1 experimental http-response script.
 * STRICTLY for manually reviewed synthetic SSE fixtures.
 * It is not authorized for real Siri / Qwen traffic.
 */
(function(){
"use strict";
var fixed="AIES_TEST_FROM_REWRITE_001";
var req=typeof $request!=="undefined" ? $request:null;
var res=typeof $response!=="undefined" ? $response:null;
var done=typeof $done==="function" ? $done:null;
if(!done)return;
var url=req && typeof req.url==="string" ? req.url:"";
if(!/^https:\/\/aies-probe\.invalid\/__aies_rewrite_fixture$/.test(url)){
  // This script is never supposed to see any other URL.
  if(typeof console!=="undefined"&&console.log)console.log("[AIES_P1] DENIED_HOST");
  done({body:"AIES_P1_DENIED"});
  return;
}
var body=res && typeof res.body==="string"?res.body:"";
if(body.length>900000 || body.slice(0,7)!=="event: "){
  if(typeof console!=="undefined"&&console.log)console.log("[AIES_P1] UNSUPPORTED_RESPONSE");
  done({body:"AIES_P1_UNSUPPORTED_RESPONSE"});
  return;
}
// The pure rewrite algorithm is tested in src/response-rewrite.js.
// P1-A transport smoke test intentionally changes the entire synthetic
// response body to a fixed marker; it does not parse real-world Siri SSE.
if(typeof console!=="undefined"&&console.log)console.log("[AIES_P1] REWRITE_ATTEMPTED");
done({body:"AIES_P1_RESPONSE_REWRITE_OK",headers:{
 "Content-Type":"text/plain; charset=utf-8","Cache-Control":"no-store"
}});
})();
