# Changelog

## 0.1.0-lab — 2026-11-18

### Included
- Shadowrocket Qwen domain REJECT baseline.
- Experimental DeepSeek request-phase local mock script, candidate SSE wrapper.
- Fixed DeepSeek HTTPS endpoint and API model. No public dashboard/control URL.
- Local-only, placeholder-based API key provisioning and cleanup scripts.
- Mandarin and English project introductions, detailed CA/key setup, security boundary and real-device test plan.
- Node.js offline behavior tests and CI workflow.

### Not validated / unsupported
- Request interception, REJECT ordering and asynchronous mock responses on the actual Shadowrocket app.
- Apple Intelligence accepting synthesized SSE without an official Qwen response.
- Device-wide no-leak guarantees, VPN-off blocking, alternate domain isolation.
- Image/vision input, production-grade encrypted key storage, multi-provider selection.

### Security notice
Do not deploy as a production replacement, enter sensitive prompts, or disable the REJECT safeguard to force success.
