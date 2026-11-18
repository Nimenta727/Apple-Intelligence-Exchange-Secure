#!/usr/bin/env node
"use strict";
// Static docs/deployment hygiene. This is NOT a substitute for real Siri testing.
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const skip=new Set([".git","node_modules"]);
function files(dir) {
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(skip.has(entry.name))continue;
    const p=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...files(p));
    else out.push(p);
  }
  return out;
}
function fail(message){console.error("Docs/deployment check FAILED: "+message);process.exitCode=1;}
const markdown=files(root).filter(x=>x.endsWith(".md"));
let links=0;
for(const source of markdown){
 const data=fs.readFileSync(source,"utf8");
 // Inline relative markdown links. External URLs and anchors are not local files.
 const re=/!?\[[^\]\n]*\]\(([^)\n]+)\)/g;
 for(const item of data.matchAll(re)){
  const raw=item[1].trim().replace(/^<|>$/g,"");
  const dest=raw.split(/\s+"/)[0].split("#")[0].split("?")[0];
  if(!dest||/^(https?:|mailto:|data:|#)/i.test(dest))continue;
  const target=path.resolve(path.dirname(source),decodeURIComponent(dest));
  if(!target.startsWith(root+path.sep)) {fail(path.relative(root,source)+": link leaves repo: "+dest);continue;}
  links++;
  if(!fs.existsSync(target)) fail(path.relative(root,source)+": broken link "+dest);
 }
}
const modulePath=path.join(root,"shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule");
const scriptPath=path.join(root,"scripts/aies_siri_deepseek_v06.js");
const moduleText=fs.readFileSync(modulePath,"utf8");
const deployed=fs.readFileSync(scriptPath,"utf8");
const hooks=moduleText.match(/^AIES60 .+type=http-(?:request|response).+script-path=.+$/gm)||[];
if(hooks.length!==2||!hooks.some(x=>x.includes("type=http-request"))||
 !hooks.some(x=>x.includes("type=http-response")))fail("v0.6 must have exactly two scoped hooks");
const urls=hooks.map(x=>(x.match(/script-path=(https:\/\/\S+)/)||[])[1]);
if(urls.length!==2||!urls[0]||urls[0]!==urls[1])fail("v0.6 hooks must share one script URL");
if(urls.some(x=>!/^https:\/\/raw\.githubusercontent\.com\/Nimenta727\/Apple-Intelligence-Exchange-Secure\/[0-9a-f]{40}\/scripts\/aies_siri_deepseek_v06\.js$/.test(x)))fail("v0.6 script must be pinned to full commit SHA");
if(!deployed.includes('version:"0.6.0-beta"'))fail("v0.6 deployed version identifier absent");
if(/DOMAIN,prod-yabuli\.qianwen\.com,REJECT/.test(moduleText))fail("v0.6 rewrite module must not accidentally contain legacy REJECT");
if(/api_key=|Authorization:\s*Bearer\s+(?!["']?\+)/i.test(moduleText))fail("sensitive configuration detected in v0.6 module");
if(!process.exitCode)console.log("Docs/deployment hygiene OK: "+markdown.length+" Markdown files, "+links+" relative links, two pinned hooks.");
