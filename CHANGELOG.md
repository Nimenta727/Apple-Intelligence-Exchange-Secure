# Changelog

## v0.6 Clean Beta — 2026-11-18 (candidate on separate branch)

- The product goal changed: requests may reach Qwen, while the intended final Siri AI response comes from DeepSeek.
- The [v0.6 development branch](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/tree/siri-deepseek-v0.6-clean) holds one Shadowrocket 60 module, a single dual-stage script, pinned deployment hooks, tests and current documentation.
- Older 40/50 experimental entrypoints were cleaned up on the candidate branch.
- The current branch is still Draft PR #10; **offline checks passed, native Siri UI and system-level fallback not validated**.
- main retains historical v0.4 research code and modules rather than claiming a production release.

## v0.4.0-lab — 2026-11-18

- Original strict request validation, experimental local SSE generation, DeepSeek adapter, static REJECT checks and offline tests.
- The 20/21 loopback/Fake-IP experiments remained research only.

## v0.2.0-lab — 2026-11-18

- Refactor early experimental script into config, request, DeepSeek, SSE, core and entry modules.
- Add deterministic bundling and test infrastructure.

## v0.1.0-lab — 2026-11-18

- Initial Shadowrocket lockdown and unverified request-phase experiment.
