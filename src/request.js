"use strict";
var C = require("./config");

function fail(code) { return {ok:false,code:code}; }
function isPlainObject(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value);
}
function validateUrl(raw) {
  if (typeof raw !== "string") return false;
  // No credentials, fragments, port overrides, host suffixes or alternate paths.
  var escaped = "^https:\\/\\/prod-yabuli\\.qianwen\\.com\\/v1\\/sessions\\/responses(?:\\?[^#]*)?$";
  return new RegExp(escaped,"i").test(raw);
}
function parseBody(req) {
  if (!req || !validateUrl(req.url)) return fail("DENIED_URL");
  var method = req.method || req.httpMethod;
  if (String(method || "").toUpperCase() !== "POST") return fail("DENIED_METHOD");
  var headers = req.headers || {};
  var type = String(headers["content-type"] || headers["Content-Type"] || "");
  if (type && !/^application\/json(?:\s*;|$)/i.test(type)) return fail("DENIED_CONTENT_TYPE");
  if (typeof req.body !== "string" || req.body.length > C.maxBodyChars) return fail("INVALID_BODY_SIZE");
  var obj;
  try { obj = JSON.parse(req.body); }
  catch (e) { return fail("INVALID_JSON"); }
  if (!isPlainObject(obj) || !isPlainObject(obj.configuration)) return fail("INVALID_SCHEMA");
  var group = obj.configuration.response_configuration_group_id;
  if (typeof group !== "string") return fail("UNSUPPORTED_SCENARIO");
  var scenario;
  if (/^(?:siri\.tqa|siri_tqa)$/i.test(group)) scenario = "siri";
  else if (/^compose(?:[_\-.]|$)/i.test(group) || /^selectedAndAllText$/i.test(group)) scenario = "writing";
  else return fail("UNSUPPORTED_SCENARIO");

  if (!Array.isArray(obj.input) || obj.input.length < 1 ||
      obj.input.length > C.maxInputItems) return fail("INVALID_INPUT_COUNT");
  var chunks = [];
  function part(value) {
    if (typeof value === "string") {
      if (/data:image\/|data:audio\/|data:video\//i.test(value)) return false;
      if (value.trim()) chunks.push(value.trim());
      return true;
    }
    if (!isPlainObject(value)) return false;
    // Text parts only; any other key indicating image/audio/file is rejected.
    var k = Object.keys(value);
    if (k.some(function(x){return ["type","text","input_text","value"].indexOf(x) === -1;})) return false;
    var typ = value.type;
    if (typ && ["text","input_text"].indexOf(typ) < 0) return false;
    var content = typeof value.text === "string" ? value.text :
      (typeof value.input_text === "string" ? value.input_text :
      (typeof value.value === "string" && typ ? value.value : null));
    if (content === null) return false;
    return part(content);
  }
  for (var i=0;i<obj.input.length;i++) {
    var item=obj.input[i];
    if (!isPlainObject(item)) return fail("UNSUPPORTED_INPUT");
    var msg = isPlainObject(item.message) ? item.message : item;
    var content = msg.content;
    if (typeof content === "string") {
      if (!part(content)) return fail("UNSUPPORTED_CONTENT");
    } else if (Array.isArray(content) && content.length > 0 && content.length <= 64) {
      for (var j=0;j<content.length;j++) {
        if (!part(content[j])) return fail("UNSUPPORTED_CONTENT");
      }
    } else return fail("UNSUPPORTED_CONTENT");
  }
  var prompt=chunks.join("\n\n");
  if (!prompt || prompt.length > C.maxPromptChars) return fail("INVALID_PROMPT_SIZE");
  return {ok:true,prompt:prompt,scenario:scenario};
}
module.exports = {parseBody:parseBody,validateUrl:validateUrl};
