"use strict";
// Local synthetic SSE fixture for unit tests. NOT captured Siri traffic.
const names=[
 "session.created",
 "session.response.created",
 "session.response.choices[].added",
 "session.response.choices[].items[].added",
 "session.response.choices[].items[].message.content[].added",
 "session.response.choices[].items[].message.content[].text.value.delta",
 "session.response.choices[].items[].message.content[].text.value.done",
 "session.response.choices[].items[].message.content[].done",
 "session.response.choices[].items[].done",
 "session.response.choices[].completed",
 "session.response.choices[].done",
 "session.response.done"
];
function frame(name,payload){
 const obj={type:name};obj[name]=payload;
 return "event: "+name+"\ndata: "+JSON.stringify(obj)+"\n\n";
}
function candidateSse(answer,query,scenario,clock){
 if(scenario!=="siri")throw Error("fixture only supports Siri text");
 const now=clock&&clock.now?clock.now():Date.now();
 const salt=String(clock&&clock.id?clock.id():"unit-test").replace(/[^a-z0-9_-]/ig,"");
 const token=String(now)+"_"+salt;
 const session="sess_aies_"+token,response="resp_aies_"+token;
 const value=JSON.stringify({content:answer,suggestions:["继续了解"],summary:query||"测试问题"});
 const output=[{message:{content:[{text:{value:value}}]}}];
 const nodes=[
  {id:session,object:"realtime.session",expires_at:Math.floor(now/1000)+120},
  {id:response,session_id:session,model:"test-only",status:"in_progress"},
  {choice_index:0,choice:{index:0,status:"in_progress"}},
  {choice_index:0,item_index:0,item:{id:"item_"+token,type:"message",message:{role:"assistant",content:[]}}},
  {choice_index:0,item_index:0,content_index:0,content:{type:"text",text:{value:""}}},
  {choice_index:0,item_index:0,content_index:0,delta:value},
  {choice_index:0,item_index:0,content_index:0,value:value},
  {choice_index:0,item_index:0,content_index:0,content:{type:"text",text:{value:value}}},
  {choice_index:0,item_index:0,item:{type:"message",message:{role:"assistant",content:[{type:"text",text:{value:value}}]}}},
  {choice_index:0,choice:{output}},
  {choice_index:0,choice:{output}},
  {id:response,choices:[{output}]}
 ];
 return names.map((n,i)=>frame(n,nodes[i])).join("");
}
function validateCandidateSse(raw,scenario){
 try{
  if(scenario!=="siri"||typeof raw!=="string"||!raw.endsWith("\n\n"))return {ok:false};
  const frames=raw.slice(0,-2).split("\n\n");
  if(frames.length<12||frames.length>256)return {ok:false};
  const rows=frames.map(f=>{
   const lines=f.split("\n");
   if(lines.length!==2||!lines[0].startsWith("event: ")||!lines[1].startsWith("data: "))throw Error("framing");
   const name=lines[0].slice(7),obj=JSON.parse(lines[1].slice(6));
   if(obj.type!==name||!Object.hasOwn(obj,name))throw Error("type");
   return {name,value:obj[name]};
  });
  const prefix=names.slice(0,5),suffix=names.slice(6);
  if(prefix.some((n,i)=>rows[i].name!==n)||
     suffix.some((n,i)=>rows[rows.length-6+i].name!==n))return {ok:false};
  const deltas=rows.slice(5,-6);
  if(!deltas.length||deltas.some(x=>x.name!==names[5]||typeof x.value.delta!=="string"))return {ok:false};
  const combined=deltas.map(x=>x.value.delta).join("");
  const ending=rows.slice(-6).map(r=>r.value);
  const vals=[
   ending[0].value,
   ending[1].content.text.value,
   ending[2].item.message.content[0].text.value,
   ending[3].choice.output[0].message.content[0].text.value,
   ending[4].choice.output[0].message.content[0].text.value,
   ending[5].choices[0].output[0].message.content[0].text.value
  ];
  if(vals.some(x=>x!==combined))return {ok:false};
  if(rows[0].value.id!==rows[1].value.session_id ||
     rows[1].value.id!==rows[rows.length-1].value.id)return {ok:false};
  const payload=JSON.parse(combined);
  return {ok:typeof payload.content==="string"&&Array.isArray(payload.suggestions)&&typeof payload.summary==="string"};
 }catch(e){return {ok:false};}
}
module.exports={candidateSse,validateCandidateSse};
