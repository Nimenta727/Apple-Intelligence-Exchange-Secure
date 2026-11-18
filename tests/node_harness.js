/* AIES offline unit tests (does not verify iPhone/Shadowrocket behavior). */
'use strict';
const assert=require('assert');
const fs=require('fs');
const vm=require('vm');
const path=require('path');
const script=fs.readFileSync(path.join(__dirname,'../scripts/sairs_router.js'),'utf8');
const base={
  url:'https://prod-yabuli.qianwen.com/v1/sessions/responses',
  method:'POST',
  body:JSON.stringify({configuration:{response_configuration_group_id:'siri.tqa'},
    input:[{message:{content:[{type:'text',text:'你好，请介绍一下AI'}]}}]})
};
function run({request=base,key='sk-test-123456789012345',
    upstream={status:200,body:JSON.stringify({choices:[{message:{content:'AI 是人工智能。'}}]})},
    upstreamError=null}={}){
  const seen={responses:[],requests:[],writes:[],reads:[]};
  const ctx={
    $request:request,
    $done:r=>seen.responses.push(r),
    $persistentStore:{
      read(k){seen.reads.push(k);return key;},
      write(v,k){seen.writes.push([v,k]);return true;}
    },
    $httpClient:{post(args,cb){seen.requests.push(args);cb(upstreamError,{status:upstream.status},upstream.body);}},
    setTimeout:()=>42,clearTimeout:()=>{},
    Math,Date,JSON,String,Number,Object,Array,RegExp,Error,isFinite
  };
  vm.runInNewContext(script,ctx,{timeout:2500});
  return seen;
}
let count=0;
function check(name,fn){
  try{fn();count++;console.log('PASS',name);}
  catch(e){process.exitCode=1;console.error('FAIL',name,e);}
}
function status(s){return s.responses[0]&&s.responses[0].response&&s.responses[0].response.status;}
check('missing key blocks network',()=>{const s=run({key:''});assert.equal(s.requests.length,0);assert.equal(status(s),503);});
check('unknown path denied',()=>{const s=run({request:{...base,url:'https://prod-yabuli.qianwen.com/sair/config?api_key=x'}});assert.equal(s.requests.length,0);assert.equal(status(s),403);});
check('foreign host denied',()=>{const s=run({request:{...base,url:'https://evil.test/anything'}});assert.equal(s.requests.length,0);assert.equal(status(s),403);});
check('non POST denied',()=>{const s=run({request:{...base,method:'GET'}});assert.equal(s.requests.length,0);assert.equal(status(s),405);});
check('missing method denied',()=>{const r={...base};delete r.method;const s=run({request:r});assert.equal(status(s),405);});
check('image denied',()=>{const j=JSON.parse(base.body);j.input[0].message.content.push({type:'image_url',image_url:{url:'data:image/jpeg;base64,xyz'}});const s=run({request:{...base,body:JSON.stringify(j)}});assert.equal(s.requests.length,0);assert.equal(status(s),422);});
check('oversized body denied',()=>{const s=run({request:{...base,body:'x'.repeat(300001)}});assert.equal(status(s),413);});
check('DeepSeek fixed endpoint + candidate SSE',()=>{const s=run();assert.equal(s.requests.length,1);assert.equal(s.requests[0].url,'https://api.deepseek.com/chat/completions');assert.equal(JSON.parse(s.requests[0].body).model,'deepseek-flash');assert.equal(status(s),200);assert.match(s.responses[0].response.body,/event: session.response.done/);assert(!s.responses[0].response.body.includes('sk-test-'));});
check('upstream network failure no fallback',()=>{const s=run({upstreamError:'offline'});assert.equal(status(s),502);assert(s.responses[0].response);});
check('upstream HTTP 401 no fallback',()=>{const s=run({upstream:{status:401,body:'{"error":"unauthorized"}'}});assert.equal(status(s),502);});
check('upstream invalid JSON no fallback',()=>{const s=run({upstream:{status:200,body:'invalid'}});assert.equal(status(s),502);});
check('no user prompt persistent writes',()=>{const s=run();assert.equal(s.writes.length,0);});
check('no dynamic endpoint or dashboard',()=>{assert(!script.includes('Access-Control-Allow-Origin'));assert(!script.includes('sair.box'));assert(!script.includes('raw.githubusercontent.com'));assert(script.includes("var API_URL = 'https://api.deepseek.com/chat/completions'"));});
check('both modules contain REJECT',()=>{for(const fn of ['00-SAIRS-LOCKDOWN.sgmodule','10-SAIRS-DEEPSEEK-LAB.sgmodule']){const text=fs.readFileSync(path.join(__dirname,'../shadowrocket/',fn),'utf8');assert(text.includes('DOMAIN,prod-yabuli.qianwen.com,REJECT'));}});
console.log('Offline tests passed:',count,'(not a real-device validation)');
