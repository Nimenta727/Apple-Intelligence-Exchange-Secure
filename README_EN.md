# Apple Intelligence Exchange Secure (AIES)

**Experimental DeepSeek-sourced answers in the native Siri interface, via Shadowrocket.**

> **v0.6.0-beta — request hook observed, end-to-end validation pending.** Offline unit tests do not demonstrate real Siri compatibility, a successful live DeepSeek API call, or protection against operating-system fallback. Not affiliated with Apple, Shadowrocket, or DeepSeek.

[中文](README.md) · [Install (Chinese)](docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [Documentation](docs/README.md) · [Security](docs/SECURITY_CURRENT_ZH.md)

> **2026-11-19 device observation:** The target Siri POST reached the HTTP request hook, but parsing failed with `ERROR_UNSUPPORTED_SIRI_REQUEST`. This update adds privacy-safe fixed `REQUEST_DIAG_*` codes and limited strict text-only envelope support. The real group ID is known, but the complete request JSON schema remains unverified; this does **not** establish working Siri responses. Refresh the 60 module to load the new pinned script.

## 2026-11-19 device-only group discovery and guarded compatibility

Real device logs show that both Siri and WritingTools use the same endpoint and can trigger `REQUEST_DIAG_GROUP_UNSUPPORTED`. The device-local probe has now identified the exact Siri group ID: `siri.multimodal.noRTI`. This update **accepts only that exact group with a Siri User-Agent and a conservative text-only envelope**, while rejecting media and unexpected fields; WritingTools is bypassed. The 600-second opt-in probe remains available for diagnostics. Real request JSON schema, SSE and native Siri output are **still unverified**.

To run the probe, use the [Chinese local group diagnosis guide](docs/SIRI_GROUP_PROBE_ZH.md) and [manual `siri_group_probe_ONCE.js`](scripts/siri_group_probe_ONCE.js) via Shadowrocket Script Test, **not** as an HTTP/event/cron hook. The [local helper](scripts/siri_group_probe_ONCE.js) arms on first run; later runs report remaining seconds, Siri/WritingTools/other-client counts, and a fixed parser stage **without disarming**. Once an identifier is captured, a manual run shows it locally and clears it. Explicit cancellation uses [siri_group_probe_STOP_ONCE.js](scripts/siri_group_probe_STOP_ONCE.js). **Replace the old iPad-local helper file as well as refreshing the 60 module**. Never upload raw PacketTunnel logs.

## Purpose

The module targets one Siri **text question-answering** network endpoint. The original request **may reach Qwen**, while the response hook attempts to obtain text from DeepSeek and rebuild the recognized answer events. Errors handled within the script do not intentionally fall back to Qwen.

**This is not a system-level provenance guarantee.** Siri may display Qwen content when the VPN, MITM or script fails to run, or when the client uses a separate path or cached response.

## Install

The only current module is [60-AIES-SIRI-DEEPSEEK-V06.sgmodule](shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule):

```text
https://raw.githubusercontent.com/Nimenta727/Apple-Intelligence-Exchange-Secure/main/shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule
```

Follow the [installation and rollback guide](docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md) before enabling it. Back up your config, disable any existing conflicting same-host REJECT rules, provide your own DeepSeek API key **only on the device**, and verify HTTPS MITM is limited to the intended host. Use only nonsensitive Siri questions in testing.

The `deepseek-flash` model ID is documented by the [official DeepSeek Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/), but real calls with the user's account and end-to-end Siri behavior remain **unverified**.

## Code layout

- `shadowrocket/`: the single installable module, with request and response hooks
- `scripts/`: the runtime JS plus one-time on-device key provisioning and clearing templates
- `tests/`: current beta unit tests and synthetic SSE fixtures
- `tools/`: documentation and deployment integrity checks
- `docs/`: current documentation only

Run `npm run check` with Node.js >=20. See the [architecture](docs/ARCHITECTURE_CURRENT_ZH.md), [debugging runbook](docs/DEBUGGING_ZH.md), [operations](docs/OPERATIONS_ZH.md), [release gates](docs/RELEASE_CHECKLIST_ZH.md), and [verification status](docs/CURRENT_STATUS_ZH.md).

API keys, CA private keys, real prompts, Authorization headers and traffic captures must not be submitted. AIES is MIT licensed and credits the published research in [boitar/sair](https://github.com/boitar/sair).

## Latest noRTI on-device input diagnosis (2026-11-19)

The observed Siri group is accepted, but two real requests still failed at `REQUEST_DIAG_INPUT_UNSUPPORTED`. The new runtime adds fixed `NORTI_SHAPE_*` categories for top-level fields, input containers and message wrappers, without recording actual field names or values or widening the allowed media payloads. Refresh the 60 module and share fixed AIES diagnostic codes only. DeepSeek/SSE/native Siri remain unverified.

## Device-local schema-only probe (2026-11-19)

The latest Siri failure yields `NORTI_SHAPE_ROOT_FIELDS` and `NORTI_SHAPE_ITEM_WRAPPER_FIELDS`. To avoid loosening media handling without evidence, a new **explicitly armed, ten-minute on-device** [schema probe](docs/SIRI_SCHEMA_PROBE_ZH.md) stores only bounded, screened JSON field **names and types**, not values, prompts or headers. It is inspected once through [manual Script Test](scripts/siri_schema_probe_ONCE.js), then erased. Requires updated 60 module and local helper. This is a diagnostic aid, **not** an end-to-end Siri/DeepSeek fix.

## Real iPad Siri field metadata (2026-11-19 11:54)

Explicit local-only schema probe established root field names/types: `client_tools:array`, `response_format:object`, `server_tools:array`, `stream:boolean`; item wrapper `type:string`; nested message `content:array`, `role:string`. The runtime now accepts only the confirmed additional root fields with matching JSON types (never forwards tool metadata to DeepSeek), and an optional wrapper `type` only if it equals `message`. Unknown discriminators and content element types remain fail-closed. **Refresh the 60 module** for the next nonsensitive Siri test; no need to rerun the schema probe. Native DeepSeek/SSE/Siri output remains unverified.

## Local one-shot sanitized Siri-to-Qwen request-body capture (2026-11-19)

The iPad schema probe also observed an `input_hint:string` field; the parser now accepts that key only as a string and discards its value. A separate, manual, ten-minute, one-shot [request-body probe](docs/SIRI_QWEN_BODY_CAPTURE_ZH.md) captures a **sanitized copy** of the Siri-bound Qwen JSON POST body, preserving a bounded `input` text structure while masking credentials and unrelated metadata. The capture is not a header dump, nor a general Qwen app/web chat interceptor. It does not establish that Qwen actually received the request or that DeepSeek/native Siri answers work.

## Device-visible DeepSeek source marker and response diagnostics (2026-11-19)

The observed Siri UI sometimes displayed a Qwen service badge and often failed to show an answer. A service badge alone is not proof of which model authored the content. The runtime now **deterministically prefixes** a verified, successfully rewritten DeepSeek answer with `【DeepSeek · AIES】`; a system instruction also asks the provider to explain its role accurately. It never marks failed responses or original Qwen text as DeepSeek, and cannot change system-controlled Siri/Qwen UI branding. Additional fixed codes distinguish missing response correlation headers, unavailable local prompt storage, request-body fallback and successful SSE preflight without exposing secrets. Native Siri success is still unverified.
