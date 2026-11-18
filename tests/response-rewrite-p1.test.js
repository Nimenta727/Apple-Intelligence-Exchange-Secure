"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const SSE=require("../src/sse");
const Rewrite=require("../src/response-rewrite");
const clock={now:()=>1730000000000,id:()=>"p1-test"};
const original=SSE.candidateSse("QWEN_FAKE_ORIGINAL_TEXT","synthetic","siri",clock);
const file=fs.readFileSync(path.join(__dirname,"../scripts/aies_response_rewrite_probe.js"),"utf8");
const moduleText=fs.readFileSync(path.join(__dirname,"../shadowrocket/40-AIES-RESPONSE-REWRITE-P1.sgmodule"),"utf8");

test("P1 strict fixture rewrite removes all source answer fields",()=>{
 const r=Rewrite.rewrite(original,Rewrite.FIXED);
 assert.equal(r.ok,true);
 assert.equal(r.eventCount,12);
 assert.ok(r.body.includes(Rewrite.FIXED));
 assert.ok(!r.body.includes("QWEN_FAKE_ORIGINAL_TEXT"));
 assert.equal(SSE.validateCandidateSse(r.body,"siri").ok,true);
});
test("P1 rejects unsupported or malformed SSE instead of returning it",()=>{
 assert.equal(Rewrite.rewrite("event: bad\ndata: {}\n\n",Rewrite.FIXED).ok,false);
 assert.equal(Rewrite.rewrite(original,"USER_TEXT").ok,false);
 assert.equal(Rewrite.rewrite(original.slice(0,40),Rewrite.FIXED).ok,false);
 const reordered=original.replace("event: session.created","event: session.response.done");
 assert.equal(Rewrite.rewrite(reordered,Rewrite.FIXED).ok,false);
});
test("P1 runtime response hook only writes to synthetic test URL",()=>{
 const run=(url,body)=>{
  const out=[],logs=[];
  vm.runInNewContext(file,{$request:{url},$response:{body},$done:x=>out.push(x),console:{log:x=>logs.push(x)}},{timeout:1000});
  return {out,logs};
 };
 const good=run("https://aies-probe.invalid/__aies_rewrite_fixture",original);
 assert.equal(good.out.length,1);
 assert.equal(good.out[0].body,"AIES_P1_RESPONSE_REWRITE_OK");
 assert.ok(good.logs.some(x=>x.includes("REWRITE_ATTEMPTED")));
 const bad=run("https://prod-yabuli.qianwen.com/v1/sessions/responses",original);
 assert.equal(bad.out[0].body,"AIES_P1_DENIED");
});
test("P1 module is response-only and never targets Siri or calls DeepSeek",()=>{
 assert.match(moduleText,/type=http-response/);
 assert.ok(!moduleText.includes("prod-yabuli.qianwen.com"));
 assert.ok(!moduleText.includes("api.deepseek.com"));
 assert.ok(!file.includes("api.deepseek.com"));
});
