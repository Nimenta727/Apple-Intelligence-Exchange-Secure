# Apple Intelligence Exchange Secure (AIES)

**Experimental Shadowrocket Siri and Apple Writing Tools text → DeepSeek response rewriting.** Not affiliated with Apple, Qwen, Shadowrocket or DeepSeek.

> **v0.6.0-beta (2026-11-19). A simple Siri answer visibly carried the DeepSeek source marker; complex/continuous calls are NOT yet reliable.** A real iPad has confirmed the `siri.multimodal.noRTI` request group, a text-only JSON input, and a 13-event Qwen SSE response. One native Qwen stream passed the existing strict preflight. A historical DeepSeek call reached the script's response-attempt stage, but a simple device-visible reply has since been observed, but complex requests remain unreliable.

[Chinese documentation hub](docs/README.md) · [Installation / rollback (ZH)](docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [Device validation matrix (ZH)](docs/VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md)

## Modules (mutually exclusive)

- [**60 DeepSeek rewriting Beta**](shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule): captures supported Siri text, uses per-request correlation, requests a DeepSeek completion, reconstructs Qwen-like SSE with the observed native event/field schema and a `【DeepSeek · AIES】` answer prefix. Unknown tools, audio/media, moderation, SSE shapes and uncorrelatable requests fail closed. **The intermittent loss of correlation metadata in Shadowrocket remains unresolved.**
- [**61 native Qwen passive diagnostics**](shadowrocket/61-AIES-QWEN-PASSIVE-DIAG.sgmodule): unchanged `$done({})` request/response hooks. Only after manual opt-in, records bounded JSON key/type structure, SSE event counts/order and allowlisted OS metadata, not prompts, answers or credentials. **Disable 60 and older REJECT/rewrite hooks first.** MITM buffering may still affect streaming.

## Verified protocol and development archive

- [Siri → Qwen request JSON outline (ZH)](docs/OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md)
- [Qwen SSE 13-event schema (ZH)](docs/OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md)
- [Full November 19 device diagnostic chronology (ZH)](docs/DEBUG_HISTORY_2026-11-19_ZH.md)
- [Root causes, design decisions, security constraints (ZH)](docs/ROOT_CAUSE_DECISIONS_2026-11-19_ZH.md)
- [Acceptance tests, privacy, rollback (ZH)](docs/VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md)
- [Current evidence status (ZH)](docs/CURRENT_STATUS_ZH.md)

```bash
npm ci
npm run check
npm test
```

`npm run check` includes syntax, mocked HTTP dual hooks, SSE schema fidelity, fail-closed safety, token privacy, no-model-call passive 61, documentation links and immutable script pin tests.

## Limitations

The original Siri query may reach Qwen before DeepSeek is invoked. The product does **not** guarantee Qwen bypass protection if the proxy or scripts do not run. A visible Qwen service badge cannot establish which model authored the text; nor does a log such as `DEEPSEEK_RESPONSE_ATTEMPTED` prove that Siri displayed it. A failed request/response correlation remains a known device-level blocker, and the client UI's acceptance of the newly schema-aligned synthetic SSE still needs live testing. Never upload raw PacketTunnel, proxy databases, private question text, API keys or certificates.

## 2026-11-19 update: first device-visible DeepSeek text and limited Qwen follow-up guard

A Siri screenshot now visibly contains the code-inserted `【DeepSeek · AIES】` answer prefix, while the system's Qwen-branded service badge remains unchanged. The latest five main Siri requests produced two attempted DeepSeek response rewrites, two missing request-correlation tags, and one unsupported SSE. The local proxy database revealed two additional Siri requests to `/v1/sessions/{opaque-id}/responses` that were not covered by the old rewrite rules.

The 60 module now includes a third, narrowly scoped **response-only SSE guard** for this session-scoped URL. It returns a generic error only for Siri HTTP-200 SSE answers; it cannot convert these extra Qwen sessions to DeepSeek and can increase failed complex Siri interactions. The primary SSE parser also tolerates standard framing variants, increases output budget to 1000 tokens/15 seconds, and enforces the source marker in answer and summary data. The intermittent loss of request correlation remains unresolved. No new manual/on-device testing was performed at the user's request.


## Same-question Siri Qwen / DeepSeek A-B experiment (2026-11-19)

A new 2,987-line device log confirmed four main Siri requests, two DeepSeek rewrite attempts, one missing correlation tag, one unsupported upstream SSE, and **four intentional failures from the session-scoped follow-up guard**. Native Qwen baseline must be tested with 60/61 fully off; the separate read-only 61 setup captures the Qwen event schema and visible example answer (now including session-scoped requests), and the 60 setup captures opted-in DeepSeek finish_reason, usage, answer text, transformed SSE stages and guard events. [Complete Chinese procedure](docs/AB_SIRI_QWEN_DEEPSEEK_COMPARISON_ZH.md). Neither monitoring mode should be confused with the fully uninstrumented control. Never share personal prompts, authorization headers or keys.

## Writing Tools Compose Beta / third-party protocol research

A guarded `WritingTools` User-Agent path now accepts only the **SAIR-reverse-engineered** `compose_selectedAndAllText` JSON text envelope, and emits a distinct `{body,refinements}` payload instead of Siri's `{content,suggestions,summary}`. This is a hypothesis-driven Beta: the user's Writing Tools full JSON/SSE has **not** been independently captured/verified. Other Writing Tools modes, media and non-text roles fail closed. The code-enforced `【DeepSeek · AIES】` prefix will appear in writing output. Both Siri and Writing Tools may send their original queries to Qwen and the selected text to DeepSeek. [Cross-site research/evidence matrix (ZH)](docs/COMMUNITY_APPLE_INTELLIGENCE_REQUESTS_2026-11-19_ZH.md) and [dated routine / next steps](docs/routine/2026-11-19-AppleIntelligence-web-community-and-WritingTools-Compose.md).
