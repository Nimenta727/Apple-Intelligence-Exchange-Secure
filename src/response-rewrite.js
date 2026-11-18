"use strict";
/* P1 offline-only SSE rewrite spike.
 * Strictly accepts the known synthetic 12-event fixture. It does NOT
 * establish compatibility with Siri's real SSE, streaming, or fallback behavior.
 */
var FIXED="AIES_TEST_FROM_REWRITE_001";
var N=[
 "session.created","session.response.created",
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
function event(name,value) {
 var data={type:name};data[name]=value;
 return "event: "+name+"\ndata: "+JSON.stringify(data)+"\n\n";
}
function fail(code){return {ok:false,code:code};}
function rewrite(stream,answer){
 try {
  if(typeof stream!=="string" || stream.length>900000 ||
     !stream.endsWith("\n\n"))return fail("INVALID_FRAMING");
  if(typeof answer!=="string" || !/^AIES_TEST_FROM_REWRITE_001$/.test(answer))
    return fail("NOT_SYNTHETIC");
  var frames=stream.slice(0,-2).split("\n\n");
  if(frames.length!==12)return fail("UNSUPPORTED_EVENT_COUNT");
  var rec=[];
  for(var i=0;i<frames.length;i++){
   var lines=frames[i].split("\n");
   if(lines.length!==2 || lines[0]!=="event: "+N[i] ||
      lines[1].slice(0,6)!=="data: ")return fail("UNSUPPORTED_EVENT");
   var obj=JSON.parse(lines[1].slice(6));
   if(!obj || obj.type!==N[i] ||
      !Object.prototype.hasOwnProperty.call(obj,N[i]) ||
      Object.keys(obj).length!==2)return fail("UNSUPPORTED_ENVELOPE");
   rec.push(obj[N[i]]);
  }
  var session=rec[0],response=rec[1];
  if(!session || typeof session.id!=="string" || !/^sess_aies_[A-Za-z0-9_-]{1,80}$/.test(session.id) ||
     !response || typeof response.id!=="string" ||
     !/^resp_aies_[A-Za-z0-9_-]{1,80}$/.test(response.id) ||
     response.session_id!==session.id)return fail("INVALID_IDS");
  if(rec[2].choice_index!==0 || rec[3].choice_index!==0 ||
     rec[4].choice_index!==0 || rec[5].choice_index!==0)return fail("INVALID_INDEX");
  if(rec[5].item_index!==0 || rec[5].content_index!==0)return fail("INVALID_INDEX");
  // Never preserve any original answer-bearing node. Construct every output
  // field independently and only carry over validated session identifiers.
  var value=JSON.stringify({content:answer,suggestions:[],summary:"AIES 测试"});
  var output=[{message:{content:[{text:{value:value}}]}}];
  var nodes=[
    {id:session.id,object:"realtime.session",expires_at:session.expires_at},
    {id:response.id,session_id:session.id,model:"aies/p1-synthetic",status:"in_progress"},
    {choice_index:0,choice:{index:0,status:"in_progress"}},
    {choice_index:0,item_index:0,item:{id:"item_aies_probe",type:"message",message:{role:"assistant",content:[]}}},
    {choice_index:0,item_index:0,content_index:0,content:{type:"text",text:{value:""}}},
    {choice_index:0,item_index:0,content_index:0,delta:value},
    {choice_index:0,item_index:0,content_index:0,value:value},
    {choice_index:0,item_index:0,content_index:0,content:{type:"text",text:{value:value}}},
    {choice_index:0,item_index:0,item:{type:"message",message:{role:"assistant",content:[{type:"text",text:{value:value}}]}}},
    {choice_index:0,choice:{output:output}},
    {choice_index:0,choice:{output:output}},
    {id:response.id,choices:[{output:output}]}
  ];
  var result=N.map(function(name,i){return event(name,nodes[i]);}).join("");
  if(result.length>900000)return fail("SIZE_LIMIT");
  return {ok:true,body:result,eventCount:nodes.length};
 }catch(e){return fail("INVALID_SSE");}
}
module.exports={rewrite:rewrite,FIXED:FIXED};
