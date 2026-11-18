/*
 * Apple Intelligence Exchange Secure / DeepSeek Lab.
 * v0.1.0-lab - NOT device validated. Original protocol research:
 * https://github.com/boitar/sair (c) 2026 boitar, MIT.
 * No automatic update, network dashboard, or configurable upstream URL.
 *
 * Important: Shadowrocket request-phase mock response + REJECT sequencing is
 * unverified. NEVER remove REJECT merely to make Siri seem to work.
 */
'use strict';
(function () {
  var VERSION = '0.1.0-lab';
  var API_URL = 'https://api.deepseek.com/chat/completions';
  var MODEL = 'deepseek-flash';
  var KEY_NAME = 'SAIRS_DEEPSEEK_API_KEY';
  var MAX_REQUEST_CHARS = 300000;
  var MAX_TEXT_CHARS = 14000;
  var MAX_ANSWER_CHARS = 20000;
  var RESPONSE_TIMEOUT_MS = 16000;
  var responded = false;
  var timeoutHandle = null;

  function safeReply(status, body, mime) {
    if (responded) return;
    responded = true;
    if (timeoutHandle !== null && typeof clearTimeout === 'function') {
      clearTimeout(timeoutHandle);
    }
    // Experimental mock response. Do not silently call $done({}) on errors.
    var response = {
      status: status,
      headers: {
        'Content-Type': mime || 'application/json; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-AIES-Lab': VERSION
      },
      body: body
    };
    if (typeof $done === 'function') $done({response: response});
    // With no $done available, safety relies on the separately tested REJECT.
  }

  function failure(status, code) {
    // Never echo sensitive prompts, API keys, upstream bodies or error text.
    safeReply(status, JSON.stringify({error:'AIES_'+code}),
      'application/json; charset=utf-8');
  }

  function isExpectedHost(url) {
    return /^https:\/\/prod-yabuli\.qianwen\.com\//i.test(url);
  }

  function isTarget(url) {
    return /^https:\/\/prod-yabuli\.qianwen\.com\/v1\/sessions\/responses(?:\?.*)?$/i.test(url);
  }

  function getMethod() {
    return String(($request && ($request.method || $request.httpMethod)) || '').toUpperCase();
  }

  function getKey() {
    if (typeof $persistentStore === 'undefined' || !$persistentStore ||
        typeof $persistentStore.read !== 'function') return '';
    var key = $persistentStore.read(KEY_NAME);
    return typeof key === 'string' ? key.trim() : '';
  }

  function extractQuery(req) {
    // No globally cached prompt. Reject images, files and unknown message parts.
    if (!req || !Array.isArray(req.input)) return {error:'UNSUPPORTED_SCHEMA'};
    var texts = [], hasImage = false, unsupported = false;

    function inspectContent(content) {
      if (typeof content === 'string') {
        if (content.indexOf('data:image/') >= 0) {hasImage = true; return;}
        if (content.trim()) texts.push(content.trim());
        return;
      }
      if (!Array.isArray(content)) {unsupported = true; return;}
      for (var i = 0; i < content.length; i++) {
        var part = content[i];
        if (typeof part === 'string') {inspectContent(part); continue;}
        if (!part || typeof part !== 'object') {unsupported = true; continue;}
        var typ = String(part.type || '').toLowerCase();
        if (typ.indexOf('image') !== -1 || part.image_url || part.input_image ||
            part.image || part.mime_type || part.file_data || part.file_url) {
          hasImage = true; continue;
        }
        if (typeof part.text === 'string') inspectContent(part.text);
        else if (typeof part.input_text === 'string') inspectContent(part.input_text);
        else if (typeof part.value === 'string' && (typ === 'text' || typ === 'input_text')) {
          inspectContent(part.value);
        } else unsupported = true;
      }
    }

    for (var i = 0; i < req.input.length; i++) {
      var item = req.input[i];
      if (!item || typeof item !== 'object') {unsupported = true; continue;}
      var msg = item.message || item;
      if (msg.content === undefined) {unsupported = true; continue;}
      inspectContent(msg.content);
    }

    if (hasImage) return {error:'VISION_NOT_ENABLED'};
    if (unsupported) return {error:'UNSUPPORTED_CONTENT'};
    var text = texts.join('\n\n').trim();
    if (!text || text.length > MAX_TEXT_CHARS) return {error:'EMPTY_OR_OVERSIZE_PROMPT'};
    var group = String((req.configuration && req.configuration.response_configuration_group_id) || '');
    var scenario = /compose|selectedAndAllText/i.test(group) ? 'writing' :
      (/siri|tqa/i.test(group) ? 'siri' : 'general');
    return {text:text,scenario:scenario};
  }

  function makePayload(answer, prompt, scenario) {
    if (scenario === 'writing') {
      return JSON.stringify({body:answer,refinements:['进一步润色','调整语气','精简表达']});
    }
    return JSON.stringify({content:answer,suggestions:['继续了解','查看相关解释'],
      summary:prompt.slice(0,18)});
  }

  function makeSse(answer, prompt, scenario) {
    // Candidate schema from upstream protocol research; NOT confirmed on iOS.
    var payload = makePayload(answer,prompt,scenario);
    var suffix = String(Date.now()) + '_' + Math.random().toString(36).slice(2,10);
    var sid = 'sess_aies_' + suffix;
    var rid = 'resp_aies_' + suffix;
    var events = [];
    function event(name, value) {
      var obj = {type:name};
      obj[name] = value;
      events.push('event: '+name+'\ndata: '+JSON.stringify(obj)+'\n\n');
    }
    event('session.created',{id:sid,object:'realtime.session',
      expires_at:Math.floor(Date.now()/1000)+120});
    event('session.response.created',{id:rid,session_id:sid,model:'aies/'+MODEL,
      status:'in_progress'});
    event('session.response.choices[].added',{choice_index:0,choice:{index:0,status:'in_progress'}});
    event('session.response.choices[].items[].added',{choice_index:0,item_index:0,
      item:{id:'item_'+suffix,type:'message',message:{role:'assistant',content:[]}}});
    event('session.response.choices[].items[].message.content[].added',{choice_index:0,item_index:0,
      content_index:0,content:{type:'text',text:{value:''}}});
    event('session.response.choices[].items[].message.content[].text.value.delta',{
      choice_index:0,item_index:0,content_index:0,delta:payload});
    event('session.response.choices[].items[].message.content[].text.value.done',{
      choice_index:0,item_index:0,content_index:0,value:payload});
    event('session.response.choices[].items[].message.content[].done',{
      choice_index:0,item_index:0,content_index:0,content:{type:'text',text:{value:payload}}});
    event('session.response.choices[].items[].done',{choice_index:0,item_index:0,
      item:{type:'message',message:{role:'assistant',content:[{type:'text',text:{value:payload}}]}}});
    event('session.response.choices[].completed',{choice_index:0,
      choice:{output:[{message:{content:[{text:{value:payload}}]}}]}});
    event('session.response.choices[].done',{choice_index:0,
      choice:{output:[{message:{content:[{text:{value:payload}}]}}]}});
    event('session.response.done',{id:rid,choices:[{
      output:[{message:{content:[{text:{value:payload}}]}}]}]});
    return events.join('');
  }

  function parseAnswer(status, body) {
    if (!(status >= 200 && status < 300)) return {error:'UPSTREAM_HTTP_ERROR'};
    if (typeof body !== 'string' || !body || body.length > 900000) {
      return {error:'UPSTREAM_BODY_INVALID'};
    }
    try {
      var obj = JSON.parse(body);
      var answer = obj && obj.choices && obj.choices[0] && obj.choices[0].message &&
        obj.choices[0].message.content;
      if (typeof answer !== 'string' || !answer.trim() ||
          answer.length > MAX_ANSWER_CHARS) return {error:'UPSTREAM_SCHEMA_INVALID'};
      return {text:answer.trim()};
    } catch(e) {return {error:'UPSTREAM_JSON_INVALID'};}
  }

  function statusCode(resp) {
    if (!resp) return 0;
    var n = Number(resp.statusCode || resp.status || 0);
    if (isFinite(n) && n > 0) return n;
    var m = String(resp.status || '').match(/\b(\d{3})\b/);
    return m ? Number(m[1]) : 0;
  }

  function main() {
    if (typeof $request === 'undefined' || !$request) {failure(503,'ENVIRONMENT');return;}
    var url = String($request.url || '');
    if (!isExpectedHost(url)) {failure(403,'HOST_DENIED');return;}
    if (!isTarget(url)) {failure(403,'PATH_DENIED');return;}
    if (getMethod() !== 'POST') {failure(405,'METHOD_DENIED');return;}
    if (typeof $request.body !== 'string' ||
        $request.body.length > MAX_REQUEST_CHARS) {
      failure(413,'REQUEST_TOO_LARGE');return;
    }
    if (/data:image\/|"(?:image_url|input_image|file_data|file_url)"\s*:/.test($request.body)) {
      failure(422,'MULTIMODAL_UNSUPPORTED');return;
    }
    var req;
    try {req=JSON.parse($request.body);} catch(e) {failure(400,'REQUEST_JSON_INVALID');return;}
    var parsed=extractQuery(req);
    if (parsed.error) {failure(422,parsed.error);return;}
    var key=getKey();
    if (!key || key.length < 12 || /PLACEHOLDER|REPLACE_WITH/i.test(key)) {
      failure(503,'KEY_NOT_PROVISIONED');return;
    }
    if (typeof $httpClient === 'undefined' || !$httpClient ||
        typeof $httpClient.post !== 'function') {failure(503,'HTTP_CLIENT_MISSING');return;}
    if (typeof setTimeout === 'function') {
      timeoutHandle=setTimeout(function(){failure(504,'DEEPSEEK_TIMEOUT');},
        RESPONSE_TIMEOUT_MS);
    }
    var prompt=parsed.text;
    var body=JSON.stringify({
      model:MODEL,
      messages:[
        {role:'system',content:parsed.scenario==='writing' ?
          '你是专业中文写作助手。只返回完成后的正文。' :
          '你是简洁、准确、自然的中文语音问答助手。直接回答问题，不要添加动作描写。'},
        {role:'user',content:prompt}
      ],
      stream:false,
      max_tokens:700
    });
    try {
      $httpClient.post({
        url:API_URL,
        headers:{
          'Content-Type':'application/json',
          'Authorization':'Bearer '+key,
          'Accept':'application/json'
        },
        body:body,
        timeout:15,
        'auto-redirect':false
      },function(error,resp,responseData){
        if (responded) return;
        if (error) {failure(502,'DEEPSEEK_REQUEST_FAILED');return;}
        var answer=parseAnswer(statusCode(resp),responseData);
        if (answer.error) {failure(502,answer.error);return;}
        safeReply(200,makeSse(answer.text,prompt,parsed.scenario),
          'text/event-stream; charset=utf-8');
      });
    } catch(e) {failure(502,'DEEPSEEK_CALL_EXCEPTION');}
  }

  try {main();} catch(e) {failure(500,'HANDLER_EXCEPTION');}
})();
