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
 "docs/AB_SIRI_QWEN_DEEPSEEK_COMPARISON_ZH.md",
 "docs/COMMUNITY_APPLE_INTELLIGENCE_REQUESTS_2026-11-19_ZH.md",
 "scripts/aies_siri_deepseek_v06.js","scripts/provision_key_ONCE.js",
 "scripts/clear_key_ONCE.js","scripts/siri_group_probe_ONCE.js","scripts/siri_group_probe_STOP_ONCE.js",
 "scripts/siri_schema_probe_ONCE.js","scripts/siri_schema_probe_STOP_ONCE.js",
 "scripts/siri_qwen_body_probe_ONCE.js","scripts/siri_qwen_body_probe_STOP_ONCE.js",
 "scripts/aies_qwen_passive_diag.js","scripts/qwen_passive_probe_ONCE.js","scripts/qwen_passive_probe_STOP_ONCE.js",
 "scripts/ab_deepseek_trace_ONCE.js","scripts/ab_deepseek_trace_STOP_ONCE.js",
 "scripts/ab_native_trace_ONCE.js","scripts/ab_native_trace_STOP_ONCE.js",
 "scripts/writing_schema_probe_ONCE.js","scripts/writing_schema_probe_STOP_ONCE.js",
 "scripts/siri_followup_schema_probe_ONCE.js","scripts/siri_followup_schema_probe_STOP_ONCE.js",
 "shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule","shadowrocket/61-AIES-QWEN-PASSIVE-DIAG.sgmodule",
 "shadowrocket/62-AIES-SIRI-DEEPSEEK-V06-LOCAL.sgmodule",
 "shadowrocket/63-AIES-SIRI-DEEPSEEK-V07-REQUEST-FIRST-LOCAL.sgmodule",
 "scripts/aies_siri_deepseek_v07_request_first.js",
 "docs/INSTALL_SIRI_DEEPSEEK_V07_REQUEST_FIRST_ZH.md",
 "tests/siri-deepseek-v07-request-first.test.js",
 "tests/siri-deepseek-v06.test.js","tests/qwen-passive-diag.test.js","tests/fixtures/siri-sse.js"
];
for(const item of activeNames)if(!fs.existsSync(path.join(root,item)))fail("missing active file: "+item);
const obsolete=["src","docs/history","docs/MAINTENANCE_ZH.md","docs/PROJECT_HANDOFF_ZH.md",
 "docs/SIRI_DEEPSEEK_RESPONSE_REWRITE_PLAN_ZH.md",
 "scripts/sairs_router.js","scripts/aies_boundary_probe.js",
 "tools/build.js","tools/check-boundary.js","tools/evaluate-boundary.js"];
for(const file of obsolete)if(fs.existsSync(path.join(root,file)))fail("obsolete file still tracked: "+file);
const modules=all.filter(x=>x.endsWith(".sgmodule")).map(relative);
const expectedModules=["shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule","shadowrocket/61-AIES-QWEN-PASSIVE-DIAG.sgmodule","shadowrocket/62-AIES-SIRI-DEEPSEEK-V06-LOCAL.sgmodule","shadowrocket/63-AIES-SIRI-DEEPSEEK-V07-REQUEST-FIRST-LOCAL.sgmodule"];
if(modules.length!==4||expectedModules.some(x=>modules.indexOf(x)<0))
 fail("expected remote v06, passive, local v06 and opt-in v07 request-first modules, got "+modules.join(","));
const scripts=all.filter(x=>relative(x).startsWith("scripts/")&&x.endsWith(".js")).map(relative);
if(scripts.length!==21)fail("expected 21 scripts including the independent opt-in v07 engine: "+scripts.join(","));
const tests=all.filter(x=>relative(x).startsWith("tests/")&&x.endsWith(".test.js")).map(relative);
if(tests.length!==3||!tests.includes("tests/siri-deepseek-v06.test.js")||!tests.includes("tests/qwen-passive-diag.test.js")||!tests.includes("tests/siri-deepseek-v07-request-first.test.js"))fail("unexpected unit tests present: "+tests.join(","));
const moduleText=fs.readFileSync(path.join(root,"shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule"),"utf8");
const js=fs.readFileSync(path.join(root,"scripts/aies_siri_deepseek_v06.js"),"utf8");
const hooks=moduleText.match(/^AIES60 .+type=http-(?:request|response).+script-path=.+$/gm)||[];
if(hooks.length!==4||
 hooks.filter(x=>x.includes("type=http-request")).length!==2||
 hooks.filter(x=>x.includes("type=http-response")).length!==2||
 !hooks.some(x=>x.startsWith("AIES60 Followup Capture = type=http-request,")&&
   x.includes("sessions")&&x.includes("responses"))||
 !hooks.some(x=>x.startsWith("AIES60 Followup Rewrite = type=http-response,")&&
   x.includes("sessions")&&x.includes("responses")))
 fail("require main and session-followup DeepSeek request/response hooks");
const urls=hooks.map(x=>x.match(/script-path=(https:\/\/\S+)/)?.[1]);
if(urls.length!==4||!urls[0]||urls.some(x=>x!==urls[0]))
 fail("all four 60 hooks must share one version-pinned script");
if(urls.some(x=>!/^https:\/\/raw\.githubusercontent\.com\/Nimenta727\/Apple-Intelligence-Exchange-Secure\/[0-9a-f]{40}\/scripts\/aies_siri_deepseek_v06\.js$/.test(x)))
 fail("runtime URL must be pinned to a full immutable commit");
const localModule=fs.readFileSync(path.join(root,"shadowrocket/62-AIES-SIRI-DEEPSEEK-V06-LOCAL.sgmodule"),"utf8");
const localHooks=localModule.match(/^AIES60 .+type=http-(?:request|response).+script-path=.+$/gm)||[];
if(localHooks.length!==4||
 localHooks.filter(x=>x.includes("type=http-request")).length!==2||
 localHooks.filter(x=>x.includes("type=http-response")).length!==2||
 localHooks.some(x=>!x.endsWith(",script-path=Script/aies_siri_deepseek_v06.js,enable=true")))
 fail("local fallback must have four main/followup hooks for same local script file");
if(/https:\/\/raw\.githubusercontent\.com|https:\/\/cdn\.jsdelivr\.net/.test(localModule))
 fail("local fallback must not reference remote runtime URL");
if(localHooks.some(x=>!hooks.some(remote=>remote.slice(0,remote.indexOf(",script-path="))===
     x.slice(0,x.indexOf(",script-path=")))))
 fail("local and remote production route matching must remain identical");
if(!localModule.includes("637484295c10627f06e610bfe040dd58e67d309a"))
 fail("local module must disclose reviewed script pin in comments");
// v0.7 is an opt-in request-first transport experiment: it MUST NOT inherit
// the response-hook correlation bug or silently modify stable v0.6 module.
const v07Module=fs.readFileSync(path.join(root,"shadowrocket/63-AIES-SIRI-DEEPSEEK-V07-REQUEST-FIRST-LOCAL.sgmodule"),"utf8");
const v07Js=fs.readFileSync(path.join(root,"scripts/aies_siri_deepseek_v07_request_first.js"),"utf8");
const v07Hooks=v07Module.match(/^AIES63 .+type=http-request.+script-path=.+$/gm)||[];
if(v07Hooks.length!==2||v07Hooks.some(x=>!x.endsWith(",script-path=Script/aies_siri_deepseek_v07_request_first.js,enable=false"))||
  /type=http-response/.test(v07Module))
 fail("v07 request-first module requires exactly two local request hooks and NO response hooks");
if(v07Hooks.some(x=>!hooks.filter(x=>x.includes("type=http-request")).some(remote=>
    x.slice(x.indexOf(",pattern="),x.indexOf(",script-path="))===
    remote.slice(remote.indexOf(",pattern="),remote.indexOf(",script-path=")))))
 fail("v07 request hook path/payload parameters must match verified v06 request hooks");
if(/script-path=https:\/\/|https:\/\/raw\.githubusercontent\.com/.test(v07Module))
 fail("v07 must never depend on remote script downloads");
if(!v07Js.includes('version:"0.7.0-request-first-experimental"')||
  !v07Js.includes("LOCAL_SSE_RESPONSE_READY")||!v07Js.includes("buildSyntheticSiriSkeleton")||
  !v07Js.includes("FOLLOWUP_STRUCTURAL_GROUP_CANDIDATE"))
 fail("v07 must explicitly version and expose request-first synthetic/SSE paths");
if(!/NEVER together/.test(v07Module)||!/QUARANTINED/.test(v07Module)||!/DISABLED/.test(v07Module))
 fail("v07 must disclose actual device failure and stay quarantined");
const passiveModule=fs.readFileSync(path.join(root,"shadowrocket/61-AIES-QWEN-PASSIVE-DIAG.sgmodule"),"utf8");
const passiveScript=fs.readFileSync(path.join(root,"scripts/aies_qwen_passive_diag.js"),"utf8");
const passiveHooks=passiveModule.match(/^AIES61 Passive (?:Followup )?(?:Request|Response) = .*type=http-(?:request|response).*script-path=.+$/gm)||[];
if(passiveHooks.length!==4||
 passiveHooks.filter(x=>x.includes("type=http-request")).length!==2||
 passiveHooks.filter(x=>x.includes("type=http-response")).length!==2||
 passiveHooks.filter(x=>x.includes("Followup")).length!==2)
 fail("diagnostic module requires pass-through request/response hooks for main and session follow-up");
const passiveUrls=passiveHooks.map(x=>x.match(/script-path=(https:\/\/\S+)/)?.[1]);
if(passiveUrls.length!==4||!passiveUrls[0]||passiveUrls.some(x=>x!==passiveUrls[0])||
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
