"use strict";
var C=require("./config");
function parseStatus(response) {
  if (!response) return 0;
  var raw=response.statusCode || response.status || "";
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  var match=String(raw).match(/\b(\d{3})\b/);
  return match ? Number(match[1]) : 0;
}
function parseReply(status,responseText) {
  if (status<200 || status>=300) return {ok:false,code:"UPSTREAM_STATUS"};
  if (typeof responseText !== "string" || !responseText ||
      responseText.length>C.maxResponseChars) return {ok:false,code:"UPSTREAM_SIZE"};
  var json;
  try { json=JSON.parse(responseText); }
  catch(e) { return {ok:false,code:"UPSTREAM_JSON"}; }
  var value=json && json.choices && json.choices[0] && json.choices[0].message &&
    json.choices[0].message.content;
  if (typeof value !== "string" || !value.trim() || value.length>C.maxAnswerChars)
    return {ok:false,code:"UPSTREAM_FORMAT"};
  return {ok:true,answer:value.trim()};
}
function callDeepSeek(httpClient,key,parsed,callback) {
  if (!httpClient || typeof httpClient.post !== "function")
    return callback({code:"HTTP_CLIENT_MISSING"});
  var body=JSON.stringify({
    model:C.deepseekModel,
    messages:[
      {role:"system",content:parsed.scenario==="writing" ?
        "你是专业中文写作助手。仅返回完成后的正文。" :
        "你是简洁、准确、自然的中文语音问答助手。直接回答，不要添加动作描写。"},
      {role:"user",content:parsed.prompt}
    ],
    stream:false,max_tokens:700
  });
  // Do not pass key through URL, logs, model output, or public dashboard.
  var options={
    url:C.deepseekUrl,method:"POST",
    headers:{"Content-Type":"application/json","Accept":"application/json","Authorization":"Bearer "+key},
    body:body,timeout:C.upstreamTimeoutSeconds,"auto-redirect":false
  };
  try {
    httpClient.post(options,function(error,response,data){
      if (error) {callback({code:"UPSTREAM_NETWORK"});return;}
      var parsedReply=parseReply(parseStatus(response),data);
      if (!parsedReply.ok) callback({code:parsedReply.code});
      else callback(null,parsedReply.answer);
    });
  } catch(e) { callback({code:"UPSTREAM_EXCEPTION"}); }
}
module.exports={callDeepSeek:callDeepSeek,parseReply:parseReply,parseStatus:parseStatus};
