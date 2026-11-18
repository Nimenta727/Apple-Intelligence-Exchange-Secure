#!/usr/bin/env node
"use strict";
// Validate repository-local Markdown links. History is retained but links must resolve.
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const excludes=new Set([".git","node_modules"]);
function visit(dir){
 const out=[];
 for(const item of fs.readdirSync(dir,{withFileTypes:true})){
  if(excludes.has(item.name))continue;
  const file=path.join(dir,item.name);
  if(item.isDirectory())out.push(...visit(file));
  else if(item.name.endsWith(".md"))out.push(file);
 }
 return out;
}
let broken=0,links=0;
const md=visit(root);
for(const file of md){
 const content=fs.readFileSync(file,"utf8");
 for(const match of content.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)){
  const dest=match[1].trim().replace(/^<|>$/g,"").split(/\s+"/)[0].split("#")[0].split("?")[0];
  if(!dest||/^(?:https?:|mailto:|data:)/i.test(dest))continue;
  let resolved;
  try{resolved=path.resolve(path.dirname(file),decodeURIComponent(dest));}
  catch(e){console.error("Invalid link encoding: "+dest);broken++;continue;}
  links++;
  if(!resolved.startsWith(root+path.sep)||!fs.existsSync(resolved)){
   console.error("Broken local link in "+path.relative(root,file)+": "+dest);
   broken++;
  }
 }
}
if(broken){console.error("Markdown link validation: "+broken+" error(s)");process.exit(1);}
console.log("Markdown link validation passed: "+md.length+" documents, "+links+" local links.");
