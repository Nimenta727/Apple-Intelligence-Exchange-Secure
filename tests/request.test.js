"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const {parseBody,validateUrl}=require("../src/request");
const C=require("../src/config");
function req(text="你好",group="siri.tqa"){
  return {url:"https://prod-yabuli.qianwen.com/v1/sessions/responses",method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({configuration:{response_configuration_group_id:group},input:[{message:{content:[{type:"text",text}]}}]})};
}
test("accepts permitted Siri text",()=>{
  assert.equal(parseBody(req()).ok,true);assert.equal(parseBody(req()).prompt,"你好");
});
test("accepts writing only for expected groups",()=>{
  assert.equal(parseBody(req("润色","compose_selectedAndAllText")).scenario,"writing");
  assert.equal(parseBody(req("测试","siri.visualIntelligenceCamera")).ok,false);
  assert.equal(parseBody(req("测试","general")).ok,false);
});
test("refuses spoofed hosts, alternate paths, and fragments",()=>{
  for(const url of [
    "https://prod-yabuli.qianwen.com.evil.test/v1/sessions/responses",
    "https://prod-yabuli.qianwen.com:444/v1/sessions/responses",
    "http://prod-yabuli.qianwen.com/v1/sessions/responses",
    "https://user:pass@prod-yabuli.qianwen.com/v1/sessions/responses",
    "https://prod-yabuli.qianwen.com/sair/config",
    "https://prod-yabuli.qianwen.com/v1/sessions/responses#frag"
  ]) assert.equal(validateUrl(url),false,url);
});
test("requires POST and valid JSON content type",()=>{
  for(const method of [undefined,"GET","DELETE","PUT"]){
    const x=req();x.method=method;assert.equal(parseBody(x).ok,false);
  }
  const y=req();y.headers={"content-type":"application/octet-stream"};
  assert.equal(parseBody(y).ok,false);
});
test("refuses malformed, missing and oversized bodies",()=>{
  const a=req();a.body="{";assert.equal(parseBody(a).ok,false);
  const b=req();delete b.body;assert.equal(parseBody(b).ok,false);
  const c=req();c.body="x".repeat(C.maxBodyChars+1);assert.equal(parseBody(c).ok,false);
});
test("rejects unrecognized content and multimodal payloads",()=>{
  const parts=[
    {type:"image_url",image_url:{url:"https://test.invalid/x.png"}},
    {type:"audio",data:"AA"},
    {type:"file",name:"a"},
    {type:"tool_call",arguments:"{}"},
    {type:"text",text:"hello",image_url:"data:image/png;base64,AA"},
    {type:"nonsense",text:"hello"}
  ];
  for(const part of parts){
    const x=req();const j=JSON.parse(x.body);
    j.input[0].message.content.push(part);x.body=JSON.stringify(j);
    assert.equal(parseBody(x).ok,false,JSON.stringify(part));
  }
});
test("rejects unknown fields hidden alongside text parts",()=>{
  const a=req();const j=JSON.parse(a.body);
  j.input[0].message.content[0].metadata={hidden:"value"};
  a.body=JSON.stringify(j);assert.equal(parseBody(a).ok,false);
});
test("rejects excessive messages and prompts",()=>{
  const a=req("a".repeat(C.maxPromptChars+1));assert.equal(parseBody(a).ok,false);
  const b=req();const j=JSON.parse(b.body);
  j.input=Array.from({length:C.maxInputItems+1},()=>({message:{content:"hello"}}));
  b.body=JSON.stringify(j);assert.equal(parseBody(b).ok,false);
});
