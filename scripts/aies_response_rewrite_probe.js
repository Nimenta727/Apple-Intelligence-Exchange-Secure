/* AIES P1 HTTPS http-response smoke test ONLY.
 * Public fixed non-sensitive GitHub raw fixture, NOT real Siri / Qwen.
 * Observe Shadowrocket response-hook behavior; not an SSE client test.
 */
(function(){
  "use strict";
  var expected="https://raw.githubusercontent.com/Nimenta727/Apple-Intelligence-Exchange-Secure/siri-deepseek-response-rewrite/tests/fixtures/p1-http-origin.txt";
  var req=typeof $request!=="undefined" ? $request : null;
  var res=typeof $response!=="undefined" ? $response : null;
  var done=typeof $done==="function" ? $done : null;
  if(!done)return;
  var url=req && typeof req.url==="string" ? req.url : "";
  function log(stage){
    if(typeof console!=="undefined" && console && typeof console.log==="function")
      console.log("[AIES_P1] "+stage);
  }
  if(url!==expected){
    log("UNEXPECTED_URL");
    done({body:"AIES_P1_UNEXPECTED_URL"});
    return;
  }
  if(!res || typeof res.body!=="string" ||
     res.body.replace(/\r\n/g,"\n").trim()!=="AIES_P1_ORIGIN_UNMODIFIED"){
    log("INVALID_FIXTURE");
    done({body:"AIES_P1_INVALID_FIXTURE"});
    return;
  }
  log("REWRITE_ATTEMPTED");
  done({body:"AIES_P1_RESPONSE_REWRITE_OK",headers:{
    "Content-Type":"text/plain; charset=utf-8",
    "Cache-Control":"no-store"
  }});
})();
