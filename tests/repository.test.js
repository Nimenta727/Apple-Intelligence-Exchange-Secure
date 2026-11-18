"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("both modules contain a matching Qwen REJECT",()=>{
  for(const p of ["shadowrocket/00-SAIRS-LOCKDOWN.sgmodule",
    "shadowrocket/10-SAIRS-DEEPSEEK-LAB.sgmodule"]){
    assert.match(read(p),/DOMAIN,prod-yabuli\.qianwen\.com,REJECT/);
  }
});
test("no mutable script URL in Shadowrocket lab module",()=>{
  const m=read("shadowrocket/10-SAIRS-DEEPSEEK-LAB.sgmodule");
  assert.match(m,/script-path=sairs_router\.js/);
  assert.doesNotMatch(m,/raw\.githubusercontent\.com/);
});
test("generated runtime has no dashboard, permissive CORS or silent passthrough",()=>{
  const code=read("scripts/sairs_router.js");
  assert.doesNotMatch(code,/Access-Control-Allow-Origin/);
  assert.doesNotMatch(code,/http:\/\/sair\.box/);
  assert.doesNotMatch(code,/raw\.githubusercontent\.com/);
  assert.doesNotMatch(code,/(?:^|\n)\s*\$done\(\s*\{\s*\}\s*\)/m);
  assert.match(code,/https:\/\/api\.deepseek\.com\/chat\/completions/);
});
test("initialization script contains placeholder, not a secret",()=>{
  const c=read("scripts/provision_key_ONCE.js");
  assert.match(c,/REPLACE_WITH_YOUR_DEEPSEEK_API_KEY/);
  assert.doesNotMatch(c,/sk-[a-zA-Z0-9]{28,}/);
});
