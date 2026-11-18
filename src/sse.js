"use strict";
var C=require("./config");
// Candidate SSE generated locally; no Qwen transcript or response is fetched.
var N=Object.freeze({
  session:"session.created",response:"session.response.created",
  choiceAdded:"session.response.choices[].added",
  itemAdded:"session.response.choices[].items[].added",
  contentAdded:"session.response.choices[].items[].message.content[].added",
  delta:"session.response.choices[].items[].message.content[].text.value.delta",
  textDone:"session.response.choices[].items[].message.content[].text.value.done",
  contentDone:"session.response.choices[].items[].message.content[].done",
  itemDone:"session.response.choices[].items[].done",
  completed:"session.response.choices[].completed",choiceDone:"session.response.choices[].done",
  responseDone:"session.response.done"
});
function encodeEvent(name,payload) {
  if (!/^session\.[a-z.\[\]]+$/.test(name)) throw Error("INVALID_EVENT_NAME");
  var obj={type:name};obj[name]=payload;
  return "event: "+name+"\ndata: "+JSON.stringify(obj)+"\n\n";
}
function boundedList(value,defaults) {
  if (!Array.isArray(value) || !value.length) return defaults.slice();
  var out=[];
  for(var i=0;i<value.length && i<3;i++) {
    if(typeof value[i]!=="string" || !value[i].trim() || value[i].length>90)
      return defaults.slice();
    out.push(value[i].trim());
  }
  return out;
}
function scenarioPayload(answer,query,scenario) {
  if (scenario!=="siri" && scenario!=="writing") throw Error("UNSUPPORTED_SCENARIO");
  if(typeof answer!=="string" || !answer.trim() || answer.length>C.maxAnswerChars)
    throw Error("INVALID_ANSWER");
  var raw=answer.trim();
  var m=raw.match(/^\x60{3}(?:json)?\s*([\s\S]*?)\s*\x60{3}$/i);
  var maybe=m ? m[1] : raw;
  var parsed=null;
  try { parsed=JSON.parse(maybe); } catch(e) {}
  var value=raw,extras={};
  if(parsed && typeof parsed==="object" && !Array.isArray(parsed)) {
    var field=scenario==="writing" ? "body" : "content";
    if(typeof parsed[field]==="string" && parsed[field].trim()) {
      value=parsed[field].trim();extras=parsed;
    }
  }
  if (!value || value.length>C.maxAnswerChars) throw Error("INVALID_CONTENT");
  if (scenario==="writing") return {body:value,refinements:boundedList(extras.refinements,
    ["进一步润色","调整语气","精简表达"])};
  var title=typeof query==="string" ? query.trim().slice(0,24) : "";
  if(typeof extras.summary==="string" && extras.summary.trim())
    title=extras.summary.trim().slice(0,80);
  return {content:value,suggestions:boundedList(extras.suggestions,
    ["继续了解","相关背景","展开说明"]),summary:title||"智能问答"};
}
function chunkText(value) {
  var chars=value.match(/[\uD800-\uDBFF][\uDC00-\uDFFF]|[\s\S]/g)||[];
  var out=[],width=2048;
  for(var i=0;i<chars.length;i+=width)out.push(chars.slice(i,i+width).join(""));
  if(!out.length) out.push("");
  return out;
}
function candidateSse(answer,query,scenario,clock) {
  var data=JSON.stringify(scenarioPayload(answer,query,scenario));
  var now=clock && typeof clock.now==="function" ? clock.now() : Date.now();
  if(typeof now!=="number" || !isFinite(now) || now<0) now=Date.now();
  var salt=clock && typeof clock.id==="function" ? clock.id() :
    Math.random().toString(36).slice(2,12);
  var token=String(Math.floor(now))+"_"+String(salt).replace(/[^a-z0-9_-]/gi,"").slice(0,24);
  var sid="sess_aies_"+token,rid="resp_aies_"+token;
  var events=[];function add(n,v){events.push(encodeEvent(n,v));}
  add(N.session,{id:sid,object:"realtime.session",expires_at:Math.floor(now/1000)+120});
  add(N.response,{id:rid,session_id:sid,model:"aies/"+C.deepseekModel,status:"in_progress"});
  add(N.choiceAdded,{choice_index:0,choice:{index:0,status:"in_progress"}});
  add(N.itemAdded,{choice_index:0,item_index:0,
    item:{id:"item_"+token,type:"message",message:{role:"assistant",content:[]}}});
  add(N.contentAdded,{choice_index:0,item_index:0,content_index:0,
    content:{type:"text",text:{value:""}}});
  var chunks=chunkText(data);
  for(var i=0;i<chunks.length;i++)
    add(N.delta,{choice_index:0,item_index:0,content_index:0,delta:chunks[i]});
  add(N.textDone,{choice_index:0,item_index:0,content_index:0,value:data});
  add(N.contentDone,{choice_index:0,item_index:0,content_index:0,
    content:{type:"text",text:{value:data}}});
  add(N.itemDone,{choice_index:0,item_index:0,
    item:{type:"message",message:{role:"assistant",content:[{type:"text",text:{value:data}}]}}});
  var output=[{message:{content:[{text:{value:data}}]}}];
  add(N.completed,{choice_index:0,choice:{output:output}});
  add(N.choiceDone,{choice_index:0,choice:{output:output}});
  add(N.responseDone,{id:rid,choices:[{output:output}]});
  var result=events.join("");
  if(result.length>C.maxResponseChars)throw Error("SSE_SIZE_LIMIT");
  return result;
}
function validateCandidateSse(stream,scenario) {
  try {
    if(typeof stream!=="string" || stream.length>C.maxResponseChars || !stream.endsWith("\n\n"))
      return {ok:false,code:"FRAMING"};
    var frames=stream.slice(0,-2).split("\n\n"),records=[];
    if(frames.length<12 || frames.length>256)return {ok:false,code:"EVENT_COUNT"};
    for(var i=0;i<frames.length;i++){
      var lines=frames[i].split("\n");
      if(lines.length!==2 || lines[0].indexOf("event: ")!==0 ||
        lines[1].indexOf("data: ")!==0)return {ok:false,code:"FRAME_LINES"};
      var name=lines[0].slice(7),obj=JSON.parse(lines[1].slice(6));
      if(obj.type!==name || !Object.prototype.hasOwnProperty.call(obj,name))
        return {ok:false,code:"EVENT_MISMATCH"};
      records.push({name:name,value:obj[name]});
    }
    var prefix=[N.session,N.response,N.choiceAdded,N.itemAdded,N.contentAdded];
    var suffix=[N.textDone,N.contentDone,N.itemDone,N.completed,N.choiceDone,N.responseDone];
    for(i=0;i<prefix.length;i++)if(records[i].name!==prefix[i])return {ok:false,code:"ORDER"};
    for(i=0;i<suffix.length;i++)
      if(records[records.length-suffix.length+i].name!==suffix[i])
        return {ok:false,code:"ORDER"};
    
    // Verify choice indices across all choice-scoped SSE events.
    for (i = 2; i < records.length - 1; i++) {
      if (!records[i].value ||
          records[i].value.choice_index !== 0) {
        return {ok:false,code:"CHOICE_INDEX"};
      }
    }

    // Verify the nested index of the initial choice.
    if (!records[2].value.choice ||
        records[2].value.choice.index !== 0) {
      return {ok:false,code:"CHOICE_INDEX"};
    }


    var n=records.length-suffix.length,joined="";
    for(i=5;i<n;i++){
      if(records[i].name!==N.delta || typeof records[i].value.delta!=="string")
        return {ok:false,code:"DELTA"};
      joined+=records[i].value.delta;
    }
    var values=[records[n].value.value,
      records[n+1].value.content.text.value,
      records[n+2].value.item.message.content[0].text.value,
      records[n+3].value.choice.output[0].message.content[0].text.value,
      records[n+4].value.choice.output[0].message.content[0].text.value,
      records[n+5].value.choices[0].output[0].message.content[0].text.value];
    if(values.some(function(x){return x!==joined;}))return {ok:false,code:"VALUE_MISMATCH"};
    if(records[0].value.id!==records[1].value.session_id ||
       records[1].value.id!==records[n+5].value.id)
      return {ok:false,code:"SESSION_MISMATCH"};
    var payload=JSON.parse(joined);
    if(scenario==="writing"){
      if(typeof payload.body!=="string" || !Array.isArray(payload.refinements))
        return {ok:false,code:"SCHEMA"};
    }else if(scenario==="siri"){
      if(typeof payload.content!=="string" || !Array.isArray(payload.suggestions) ||
         typeof payload.summary!=="string")return {ok:false,code:"SCHEMA"};
    }else return {ok:false,code:"SCENARIO"};
    return {ok:true,eventCount:records.length,deltaCount:n-5};
  }catch(e){return {ok:false,code:"INVALID_STREAM"};}
}
module.exports={candidateSse:candidateSse,encodeEvent:encodeEvent,
  scenarioPayload:scenarioPayload,validateCandidateSse:validateCandidateSse};
