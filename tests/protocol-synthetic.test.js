"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Request=require("../src/request");
const Provider=require("../src/deepseek");
const SSE=require("../src/sse");
const C=require("../src/config");
const siriRequest={url:"https://prod-yabuli.qianwen.com/v1/sessions/responses",
  method:"POST",headers:{"Content-Type":"application/json"},
  body:JSON.stringify({configuration:{response_configuration_group_id:"siri.tqa"},
    input:[{message:{content:[{type:"text",text:"FAKE_QUESTION_001"}]}}]})};
const clock={now:()=>1730000000000,id:()=>"synthetic-01"};
test("synthetic Siri request -> fake DeepSeek reply -> independently generated SSE",()=>{
  const parsed=Request.parseBody(siriRequest);
  assert.equal(parsed.ok,true);
  const requests=[];let answer=null;
  const http={post:(options,callback)=>{
    requests.push(options);
    callback(null,{status:200},JSON.stringify({
      choices:[{message:{content:"FAKE_ANSWER_001"}}]}));
  }};
  Provider.callDeepSeek(http,"dummy_key_123456789",parsed,(error,result)=>{
    assert.equal(error,null);answer=result;
  });
  assert.equal(requests.length,1);
  assert.equal(requests[0].url,C.deepseekUrl);
  assert.equal(JSON.parse(requests[0].body).model,C.deepseekModel);
  assert.ok(!JSON.stringify(requests[0].headers).includes("prod-yabuli.qianwen.com"));
  const stream=SSE.candidateSse(answer,parsed.prompt,parsed.scenario,clock);
  const verdict=SSE.validateCandidateSse(stream,"siri");
  assert.equal(verdict.ok,true);
  assert.equal(verdict.eventCount,12);
  assert.match(stream,/FAKE_ANSWER_001/);
  assert.ok(!stream.includes("dummy_key_123456789"));
});
test("writing tools produce body and refinements with a consistent stream",()=>{
  const structured=JSON.stringify({body:"人工合成改写",refinements:["更简洁","更正式"],other:"ignored"});
  const result=SSE.scenarioPayload(structured,"test","writing");
  assert.deepEqual(result,{body:"人工合成改写",refinements:["更简洁","更正式"]});
  const stream=SSE.candidateSse(structured,"test","writing",clock);
  assert.equal(SSE.validateCandidateSse(stream,"writing").ok,true);
  assert.ok(!stream.includes('"other"'));
});
test("Siri extracts structured JSON content without unrelated fields",()=>{
  const structured=JSON.stringify({content:"内容",suggestions:["继续"],summary:"摘要",
    access_token:"synthetic_should_not_appear"});
  const data=SSE.scenarioPayload(structured,"original","siri");
  assert.deepEqual(data,{content:"内容",suggestions:["继续"],summary:"摘要"});
  assert.equal(SSE.validateCandidateSse(SSE.candidateSse(structured,"original","siri",clock),"siri").ok,true);
});
test("unicode surrogate pairs, newlines, and quotes survive long delta chunks",()=>{
  const answer=("🚀\n\"转义\"\u0000").repeat(400);
  const stream=SSE.candidateSse(answer,"fake prompt","siri",clock);
  const v=SSE.validateCandidateSse(stream,"siri");
  assert.equal(v.ok,true);
  assert.ok(v.deltaCount>1);
});
test("corrupted event order and final node are rejected",()=>{
  const s=SSE.candidateSse("hello","title","siri",clock);
  assert.equal(SSE.validateCandidateSse(s.replace("event: session.created",
    "event: session.response.done"),"siri").ok,false);
  const t=s.replace('delta":"{','delta":"!');
  assert.equal(SSE.validateCandidateSse(t,"siri").ok,false);
});
test("unknown scenarios and invalid model answers fail closed",()=>{
  assert.throws(()=>SSE.candidateSse("reply","title","vision",clock));
  assert.throws(()=>SSE.candidateSse("","title","siri",clock));
  assert.throws(()=>SSE.candidateSse("x".repeat(C.maxAnswerChars+1),"title","siri",clock));
  assert.equal(SSE.validateCandidateSse("event: invalid\n\n","siri").ok,false);
});
test("oversized model suggestion arrays are bounded to safe defaults",()=>{
  const structured=JSON.stringify({content:"okay",suggestions:["x".repeat(1000)]});
  const result=SSE.scenarioPayload(structured,"prompt","siri");
  assert.ok(result.suggestions.length<=3);
  assert.ok(result.suggestions.every(x=>x.length<=90));
});
test("the SSE encoder never invokes a provider by itself",()=>{
  assert.equal(C.providerEnabled,false);
  const s=SSE.candidateSse("synthetic","synthetic","siri",clock);
  assert.equal(SSE.validateCandidateSse(s,"siri").ok,true);
});
