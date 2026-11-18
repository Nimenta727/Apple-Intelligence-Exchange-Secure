"use strict";
// Audited defaults. No runtime URL-based configuration or remote code loading.
module.exports = Object.freeze({
  version: "0.2.1-lab",
  diagnosticsEnabled: true,
  host: "prod-yabuli.qianwen.com",
  targetPath: "/v1/sessions/responses",
  deepseekUrl: "https://api.deepseek.com/chat/completions",
  deepseekModel: "deepseek-flash",
  keyName: "SAIRS_DEEPSEEK_API_KEY",
  maxBodyChars: 300000,
  maxPromptChars: 14000,
  maxAnswerChars: 20000,
  maxResponseChars: 900000,
  maxInputItems: 12,
  upstreamTimeoutSeconds: 15,
  safetyTimeoutMillis: 16000
});
