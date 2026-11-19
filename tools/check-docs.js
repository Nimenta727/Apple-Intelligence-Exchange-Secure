#!/usr/bin/env node
"use strict";
// Current v0.6 repository hygiene checks. Not a real-device Siri test.
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
let failed=0,checked=0;
function fail(msg){console.error("[AIES CHECK] "+msg);failed++;}
function walk(dir){
 let items=[];
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  if(e.name===".git"||e.name==="node_modules")continue;
  const p=path.join(dir,e.name);
  items.push(...(e.isDirectory()?walk(p):[p]));
 }
 return items;
}
const relative=p=>path.relative(root,p).replace(/\\/g,"/");
const all=walk(root),markdown=all.filter(p=>p.endsWith(".md"));
for(const file of markdown){
 const text=fs.readFileSync(file,"utf8");
 for(const match of text.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)){
  const raw=match[1].trim().replace(/^<|>$/g,"");
  const target=raw.split(/\s+"/)[0].split("#")[0].split("?")[0];
  if(!target||/^(?:https?:|mailto:|data:)/i.test(target))continue;
  let resolved;
  try{resolved=path.resolve(path.dirname(file),decodeURIComponent(target));}
  catch(e){fail(relative(file)+" invalid link encoding: "+target);continue;}
  checked++;
  if(!resolved.startsWith(root+path.sep)||!fs.existsSync(resolved))
   fail(relative(file)+" broken relative link: "+target);
 }
}
const activeNames=[
 "README.md","README_EN.md","CHANGELOG.md","CONTRIBUTING.md",
 "docs/README.md","docs/CURRENT_STATUS_ZH.md","docs/ISSUES_AND_DECISIONS_ZH.md",
 "docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md","docs/USER_GUIDE_ZH.md",
 "docs/DEBUGGING_ZH.md","docs/SIRI_GROUP_PROBE_ZH.md","docs/SIRI_SCHEMA_PROBE_ZH.md","docs/SIRI_QWEN_BODY_CAPTURE_ZH.md","docs/ARCHITECTURE_CURRENT_ZH.md",
 "docs/OPERATIONS_ZH.md","docs/SECURITY_CURRENT_ZH.md",
 "docs/RELEASE_CHECKLIST_ZH.md",
 "docs/DEBUG_HISTORY_2026-11-19_ZH.md","docs/OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md",
 "docs/OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md","docs/ROOT_CAUSE_DECISIONS_2026-11-19_ZH.md",
 "docs/VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md","docs/QWEN_PASSIVE_DIAG_ZH.md",
 "scripts/aies_siri_deepseek_v06.js","scripts/provision_key_ONCE.js",
 "scripts/clear_key_ONCE.js","scripts/siri_group_probe_ONCE.js","scripts/siri_group_probe_STOP_ONCE.js",
 "scripts/siri_schema_probe_ONCE.js","scripts/siri_schema_probe_STOP_ONCE.js",
 "scripts/siri_qwen_body_probe_ONCE.js","scripts/siri_qwen_body_probe_STOP_ONCE.js",
 "scripts/aies_qwen_passive_diag.js","scripts/qwen_passive_probe_ONCE.js","scripts/qwen_passive_probe_STOP_ONCE.js",
 "shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule","shadowrocket/61-AIES-QWEN-PASSIVE-DIAG.sgmodule",
 "tests/siri-deepseek-v06.test.js","tests/qwen-passive-diag.test.js","tests/fixtures/siri-sse.js"
];
for(const item of activeNames)if(!fs.existsSync(path.join(root,item)))fail("missing active file: "+item);
const obsolete=["src","docs/history","docs/MAINTENANCE_ZH.md","docs/PROJECT_HANDOFF_ZH.md",
 "docs/SIRI_DEEPSEEK_RESPONSE_REWRITE_PLAN_ZH.md",
 "scripts/sairs_router.js","scripts/aies_boundary_probe.js",
 "tools/build.js","tools/check-boundary.js","tools/evaluate-boundary.js"];
for(const file of obsolete)if(fs.existsSync(path.join(root,file)))fail("obsolete file still tracked: "+file);
const modules=all.filter(x=>x.endsWith(".sgmodule")).map(relative);
const expectedModules=["shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule","shadowrocket/61-AIES-QWEN-PASSIVE-DIAG.sgmodule"];
if(modules.length!==2||expectedModules.some(x=>modules.indexOf(x)<0))
 fail("expected one production module and one opt-in passive diagnostic module, got "+modules.join(","));
const scripts=all.filter(x=>relative(x).startsWith("scripts/")&&x.endsWith(".js")).map(relative);
if(scripts.length!==12)fail("expected production runtime, passive runtime, two Key scripts and eight manual diagnostic helpers: "+scripts.join(","));
const tests=all.filter(x=>relative(x).startsWith("tests/")&&x.endsWith(".test.js")).map(relative);
if(tests.length!==2||!tests.includes("tests/siri-deepseek-v06.test.js")||!tests.includes("tests/qwen-passive-diag.test.js"))fail("unexpected unit tests present: "+tests.join(","));
const moduleText=fs.readFileSync(path.join(root,"shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule"),"utf8");
const js=fs.readFileSync(path.join(root,"scripts/aies_siri_deepseek_v06.js"),"utf8");
const hooks=moduleText.match(/^AIES60 .+type=http-(?:request|response).+script-path=.+$/gm)||[];
if(hooks.length!==3||
 hooks.filter(x=>x.includes("type=http-request")).length!==1||
 hooks.filter(x=>x.includes("type=http-response")).length!==2||
 !hooks.some(x=>x.startsWith("AIES60 Scoped Qwen SSE Guard = type=http-response,")&&
   x.includes("sessions")&&x.includes("responses")))
 fail("require one DeepSeek request hook, one rewrite response hook and one scoped follow-up response guard");
const urls=hooks.map(x=>x.match(/script-path=(https:\/\/\S+)/)?.[1]);
if(urls.length!==3||!urls[0]||urls.some(x=>x!==urls[0]))
 fail("all three 60 hooks must share one version-pinned script");
if(urls.some(x=>!/^https:\/\/raw\.githubusercontent\.com\/Nimenta727\/Apple-Intelligence-Exchange-Secure\/[0-9a-f]{40}\/scripts\/aies_siri_deepseek_v06\.js$/.test(x)))
 fail("runtime URL must be pinned to a full immutable commit");
const passiveModule=fs.readFileSync(path.join(root,"shadowrocket/61-AIES-QWEN-PASSIVE-DIAG.sgmodule"),"utf8");
const passiveScript=fs.readFileSync(path.join(root,"scripts/aies_qwen_passive_diag.js"),"utf8");
const passiveHooks=passiveModule.match(/^AIES61 Passive (?:Request|Response) = .*type=http-(?:request|response).*script-path=.+$/gm)||[];
if(passiveHooks.length!==2||!passiveHooks.some(x=>x.includes("type=http-request"))||
 !passiveHooks.some(x=>x.includes("type=http-response")))
 fail("diagnostic module requires one passive request and one response hook");
const passiveUrls=passiveHooks.map(x=>x.match(/script-path=(https:\/\/\S+)/)?.[1]);
if(passiveUrls.length!==2||!passiveUrls[0]||passiveUrls[0]!==passiveUrls[1]||
 passiveUrls.some(x=>!/^https:\/\/raw\.githubusercontent\.com\/Nimenta727\/Apple-Intelligence-Exchange-Secure\/[0-9a-f]{40}\/scripts\/aies_qwen_passive_diag\.js$/.test(x)))
 fail("passive diagnostic runtime must be pinned to same immutable commit in both hooks");
if(!passiveScript.includes('$done({})'))fail("passive mode must finish with unchanged traffic");
if(/\$httpClient|api\.deepseek\.com|SAIRS_DEEPSEEK_API_KEY/.test(passiveScript))fail("passive runtime must not call model or access model key");
if(/\[Rule\]|\[URL Rewrite\]|DOMAIN,.*REJECT/i.test(passiveModule))fail("passive diagnostic module must not route or rewrite Qwen traffic");

if(!js.includes('version:"0.6.0-beta"'))fail("script version mismatch");
if(!fs.readFileSync(path.join(root,"README.md"),"utf8").includes("v0.6.0-beta"))fail("README lacks current version");
if(/DOMAIN,prod-yabuli\.qianwen\.com,REJECT/.test(moduleText))fail("conflicting reject rule in current module");
if(/api_key=|Authorization:\s*Bearer\s+(?!["']?\+)/i.test(moduleText))fail("sensitive config in module");
if(failed)process.exit(1);
console.log("AIES v0.6 checks passed: "+markdown.length+" Markdown files, "+checked+" links, production + opt-in passive module, pinned dual hooks.");
