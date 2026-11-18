"use strict";
var C = require("./config");
function encodeEvent(name,payload) {
  var obj={type:name};
  obj[name]=payload;
  return "event: "+name+"\ndata: "+JSON.stringify(obj)+"\n\n";
}
function candidateSse(answer,query,scenario,clock) {
  // The protocol envelope is an EXPERIMENTAL candidate, not device verified.
  var data = scenario === "writing" ?
    JSON.stringify({body:answer,refinements:["进一步润色","调整语气","精简表达"]}) :
    JSON.stringify({content:answer,suggestions:["继续了解","相关背景"],summary:query.slice(0,18)});
  var now=clock && typeof clock.now === "function" ? clock.now() : Date.now();
  var salt=clock && typeof clock.id === "function" ? clock.id() :
    Math.random().toString(36).slice(2,12);
  var token=String(now)+"_"+String(salt).replace(/[^a-z0-9_-]/gi,"").slice(0,24);
  var sid="sess_aies_"+token, rid="resp_aies_"+token;
  var lines=[];
  function append(n,v) {lines.push(encodeEvent(n,v));}
  append("session.created",{id:sid,object:"realtime.session",expires_at:Math.floor(now/1000)+120});
  append("session.response.created",{id:rid,session_id:sid,model:"aies/"+C.deepseekModel,status:"in_progress"});
  append("session.response.choices[].added",{choice_index:0,choice:{index:0,status:"in_progress"}});
  append("session.response.choices[].items[].added",{choice_index:0,item_index:0,
    item:{id:"item_"+token,type:"message",message:{role:"assistant",content:[]}}});
  append("session.response.choices[].items[].message.content[].added",
    {choice_index:0,item_index:0,content_index:0,content:{type:"text",text:{value:""}}});
  append("session.response.choices[].items[].message.content[].text.value.delta",
    {choice_index:0,item_index:0,content_index:0,delta:data});
  append("session.response.choices[].items[].message.content[].text.value.done",
    {choice_index:0,item_index:0,content_index:0,value:data});
  append("session.response.choices[].items[].message.content[].done",
    {choice_index:0,item_index:0,content_index:0,content:{type:"text",text:{value:data}}});
  append("session.response.choices[].items[].done",
    {choice_index:0,item_index:0,item:{type:"message",message:{role:"assistant",
      content:[{type:"text",text:{value:data}}]}}});
  append("session.response.choices[].completed",
    {choice_index:0,choice:{output:[{message:{content:[{text:{value:data}}]}}]}});
  append("session.response.choices[].done",
    {choice_index:0,choice:{output:[{message:{content:[{text:{value:data}}]}}]}});
  append("session.response.done",
    {id:rid,choices:[{output:[{message:{content:[{text:{value:data}}]}}]}]});
  return lines.join("");
}
module.exports={candidateSse:candidateSse,encodeEvent:encodeEvent};
