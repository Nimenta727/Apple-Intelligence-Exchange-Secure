# Apple Intelligence Exchange Secure (AIES)

**An experimental Shadowrocket bridge for native Siri text answers sourced from DeepSeek.** Based in part on publicly available protocol research from [boitar/sair](https://github.com/boitar/sair) (MIT).

> **Current candidate: v0.6 Clean Beta — offline tests have passed; actual native Siri compatibility has NOT been validated.** The updated goal allows the original Siri request to reach Qwen, but aims to display an answer sourced from DeepSeek. When the proxy, MITM, response hook or Siri itself bypasses the rewrite, a Qwen answer may still appear. **There is no unconditional DeepSeek-only guarantee.**

[中文 README](README.md) · [Documentation index](docs/README.md) · [Installation (Chinese)](docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [Security](docs/SECURITY_CURRENT_ZH.md) · [Changelog](CHANGELOG.md)

## Scope and approach

The current candidate targets one Siri **text question-answering** endpoint only, not Writing Tools, images, vision, a separate chat interface or general model routing.

1. A Shadowrocket HTTP request hook attempts to parse a supported Siri text request and associate its context with a single request.
2. The original request may continue to Qwen; its eventual SSE response is used only as a protocol reference.
3. An HTTP response hook calls the user-authorized DeepSeek API and attempts to rebuild recognized SSE answer fields with DeepSeek's answer.
4. When the script itself detects a model/protocol failure, it attempts to return an error instead of falling back to Qwen.
5. If the script never runs or traffic bypasses it, no JavaScript-level error handling can prevent native upstream output.

**No real-device Siri result is claimed here.**

## Versions and deployment

| Branch | Purpose | Status |
|---|---|---|
| `siri-deepseek-v0.6-clean` | Current one-module installation candidate | Draft PR #10, pending device acceptance |
| `main` (v0.4.0-lab) | Previous no-upstream research baseline | Historical, not current beta deployment |
| Earlier 30/31/40/50 experiments | Network/fault/rewrite prototypes | Not required to install v0.6 |

The **single v0.6 module** is [60-AIES-SIRI-DEEPSEEK-V06.sgmodule](shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule), backed by [aies_siri_deepseek_v06.js](scripts/aies_siri_deepseek_v06.js). Both request and response hooks are pinned to the same immutable script commit. See the [installation and rollback guide](docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md).

For this new mode, the former `00-SAIRS-LOCKDOWN` REJECT module conflicts with the intended Qwen response path. Do **not** simply mix 00 and 60. Back up your setup and follow the documented, explicit mode switch. The original Qwen prompt may then be transmitted.

## Security and limitations

The API key must remain on the user's device and must not be committed, sent in a URL or disclosed in chat. Shadowrocket's local persistent store currently holds short-lived prompt context; physical deletion/encryption properties are unverified. HTTPS MITM and a locally trusted CA have their own risks. SSE streaming/compression, response interception, native Siri UI acceptance, timeouts and system bypass/fallback still require independent device validation.

Code checks do not prove Siri or system-level answer provenance. The candidate is **not production-ready**. See [current status](docs/CURRENT_STATUS_ZH.md), [release gates](docs/RELEASE_CHECKLIST_ZH.md), [maintenance](docs/MAINTENANCE_ZH.md) and [original MIT license](LICENSE).

## Development

Run `npm run check` for offline checks. The historical modular `src/` tree and generated `scripts/sairs_router.js` belong to v0.4 research; the actual v0.6 deployed script is a separate self-contained implementation, so the legacy build command does not generate it. Keep tests, docs and pinned deployment URLs synchronized.
