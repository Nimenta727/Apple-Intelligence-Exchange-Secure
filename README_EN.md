# Apple Intelligence Exchange Secure (AIES)

**Experimental DeepSeek-sourced answers in the native Siri interface, via Shadowrocket.**

> **v0.6.0-beta — device validation pending.** Offline unit tests do not demonstrate real Siri compatibility, a successful live DeepSeek API call, or protection against operating-system fallback. Not affiliated with Apple, Shadowrocket, or DeepSeek.

[中文](README.md) · [Install (Chinese)](docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [Documentation](docs/README.md) · [Security](docs/SECURITY_CURRENT_ZH.md)

## Purpose

The module targets one Siri **text question-answering** network endpoint. The original request **may reach Qwen**, while the response hook attempts to obtain text from DeepSeek and rebuild the recognized answer events. Errors handled within the script do not intentionally fall back to Qwen.

**This is not a system-level provenance guarantee.** Siri may display Qwen content when the VPN, MITM or script fails to run, or when the client uses a separate path or cached response.

## Install

The only current module is [60-AIES-SIRI-DEEPSEEK-V06.sgmodule](shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule):

```text
https://raw.githubusercontent.com/Nimenta727/Apple-Intelligence-Exchange-Secure/main/shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule
```

Follow the [installation and rollback guide](docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md) before enabling it. Back up your config, disable any existing conflicting same-host REJECT rules, provide your own DeepSeek API key **only on the device**, and verify HTTPS MITM is limited to the intended host. Use only nonsensitive Siri questions in testing.

The current script specifies `deepseek-flash`; live availability of that model ID has **not been verified**. Do not interpret importing the module as proof of API compatibility.

## Code layout

- `shadowrocket/`: the single installable module, with request and response hooks
- `scripts/`: the runtime JS plus one-time on-device key provisioning and clearing templates
- `tests/`: current beta unit tests and synthetic SSE fixtures
- `tools/`: documentation and deployment integrity checks
- `docs/`: current documentation only

Run `npm run check` with Node.js >=20. See the [architecture](docs/ARCHITECTURE_CURRENT_ZH.md), [debugging runbook](docs/DEBUGGING_ZH.md), [operations](docs/OPERATIONS_ZH.md), [release gates](docs/RELEASE_CHECKLIST_ZH.md), and [verification status](docs/CURRENT_STATUS_ZH.md).

API keys, CA private keys, real prompts, Authorization headers and traffic captures must not be submitted. AIES is MIT licensed and credits the published research in [boitar/sair](https://github.com/boitar/sair).
