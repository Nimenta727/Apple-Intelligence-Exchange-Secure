# Apple Intelligence Exchange Secure (AIES)

**Research project for displaying DeepSeek-sourced answers in the native Siri interface via Shadowrocket.**

> **Updated scope (November 18, 2026):** Original Siri text requests may still reach Qwen. The new objective is to show only DeepSeek-sourced AI answers to the user. The **v0.6 Clean Beta candidate** has passed offline checks but native Siri behavior, actual DeepSeek API calls, and system-level fallback remain **unverified**. It is not production-ready.

## Current branches

- [v0.6 Clean Beta candidate](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/tree/siri-deepseek-v0.6-clean) — the latest one-module response rewrite experiment ([Draft PR #10](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/10)).
- `main` (v0.4.0-lab) — preserved baseline of earlier Qwen-blocking experiments and their static tests; **not** the new beta installation source.

## Current documentation

[Installation and rollback](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [Documentation index](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/README.md) · [Current status](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/CURRENT_STATUS_ZH.md) · [Security and privacy](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/SECURITY_CURRENT_ZH.md) · [Release gates](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/RELEASE_CHECKLIST_ZH.md).

The newer script attempts to capture a supported Siri request, ask the DeepSeek API for an answer and rewrite recognized Qwen SSE answer fields. It avoids an intentional **script-level** Qwen fallback, but it cannot prevent native Qwen answers if the proxy hook or VPN does not run. Real-device confirmation is still required.

Keep DeepSeek keys, private CA material, user prompts, Authorization headers and packet captures out of this public repository. Retain upstream MIT attribution. [中文 README](README.md) · [Changelog](CHANGELOG.md) · [License](LICENSE).
