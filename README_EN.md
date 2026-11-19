# Apple Intelligence Exchange Secure (AIES)

**Experimental DeepSeek-sourced answers in the native Siri interface, via Shadowrocket.**

> **v0.6.0-beta — request hook observed, end-to-end validation pending.** Offline unit tests do not demonstrate real Siri compatibility, a successful live DeepSeek API call, or protection against operating-system fallback. Not affiliated with Apple, Shadowrocket, or DeepSeek.

[中文](README.md) · [Install (Chinese)](docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [Documentation](docs/README.md) · [Security](docs/SECURITY_CURRENT_ZH.md)

> **2026-11-19 device observation:** The target Siri POST reached the HTTP request hook, but parsing failed with `ERROR_UNSUPPORTED_SIRI_REQUEST`. This update adds privacy-safe fixed `REQUEST_DIAG_*` codes and limited strict text-only envelope support. The real request JSON schema is still unknown; this does **not** establish working Siri responses. Refresh the 60 module to load the new pinned script.

## 2026-11-19 device-only group discovery

Real device logs show that both Siri and WritingTools use the same endpoint and can trigger `REQUEST_DIAG_GROUP_UNSUPPORTED`. The actual Siri group identifier is not known. This update bypasses WritingTools and adds an **explicitly armed, one-shot 600-second (10-minute) on-device probe**. It does not add unknown groups to the allowlist, and native Siri output is **still unverified**.

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
