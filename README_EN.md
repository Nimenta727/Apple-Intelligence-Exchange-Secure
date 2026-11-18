# Apple Intelligence Exchange Secure

**Shadowrocket-first research prototype — v0.2.0-lab, NOT production-ready.**

This project is a security-first experimental reimplementation inspired by the publicly documented protocol research in [boitar/sair](https://github.com/boitar/sair). It explores intercepting a selected Apple Intelligence/Qwen HTTP request *before forwarding* and asking a user-authorized DeepSeek API to produce a response wrapped in a locally generated candidate SSE stream.

**Unverified:** Shadowrocket's request-phase mock response behavior, interaction with REJECT rules, Apple Intelligence's acceptance of synthesized SSE, and coverage of every relevant Apple/Qwen network route. It is **not** a proven full replacement for the Apple/Qwen cloud integration.

## Features

- Local Shadowrocket scripts with no upstream auto-update or Web Dashboard
- Fail-closed behavior in script logic; dedicated domain REJECT baseline
- Fixed DeepSeek HTTPS Chat Completions endpoint; \`deepseek-flash\`
- No model routing or API keys from URL parameters; no plaintext keys committed
- Conservative text parsing; multimedia is explicitly rejected in this prototype
- Offline test harness

## Quick start

1. Start with [00-SAIRS-LOCKDOWN.sgmodule](shadowrocket/00-SAIRS-LOCKDOWN.sgmodule) (no CA/key required). Verify the Qwen domain is rejected.
2. Review the [archived Chinese setup guide](history/CONFIGURATION_ZH.md) for certificate generation, device trust and DeepSeek key provisioning.
3. Only in a dedicated test environment, install the local script and experiment with [10-SAIRS-DEEPSEEK-LAB.sgmodule](shadowrocket/10-SAIRS-DEEPSEEK-LAB.sgmodule). **Do not remove REJECT solely to force Siri to work.**
4. Run \`node --check scripts/sairs_router.js\` and \`npm run check\`, then the archived manual [device test plan](history/TEST_PLAN.md).

**CA private key:** generated and held locally by Shadowrocket. Never type it into the SAIR script or GitHub. **DeepSeek API key:** separate credential, created on the official DeepSeek developer platform; the sample one-time provisioning script contains only a placeholder. If your Shadowrocket version does not support a confirmed local manual script execution path, real-key provisioning is not validated — stop instead of pasting the key into public URLs or module arguments.

## Security and limitations

Running this on an iPhone does **not** mean fully offline or Apple-cloud-free. DeepSeek receives prompts by design; Apple and other system services may still communicate with other servers. VPN downtime may bypass all Shadowrocket controls. Root CA trust is system-wide even if MITM is configured for one host.

See [Security](docs/SECURITY_ZH.md) and [Test Plan](history/TEST_PLAN.md). MIT license; original author attribution retained. Not affiliated with Apple, Shadowrocket, DeepSeek, or the original SAIR maintainers.


## Modular architecture (v0.2.0-lab)

Maintain src/config.js, src/request.js, src/deepseek.js, src/sse.js, src/core.js, and src/entry.js separately. The deployed scripts/sairs_router.js is a deterministic generated single-file bundle. Run npm run build and npm run check whenever source code changes; do not edit the generated file directly.

See [Architecture (Chinese)](docs/ARCHITECTURE_ZH.md) for maintenance, threat boundaries and test expectations.
