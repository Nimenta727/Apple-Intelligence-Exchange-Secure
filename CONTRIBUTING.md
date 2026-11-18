# 贡献指南 / Contributing

Apple Intelligence Exchange Secure (AIES) is an **unverified Shadowrocket lab**, not a production Siri replacement.

## Ground rules

1. Keep the matching Qwen REJECT safeguard until a real-device proof demonstrates strict isolation. A working model call without privacy isolation is not a pass.
2. Do not submit a real DeepSeek API Key, certificate private key, CA backup, browser history, actual user prompts, or unredacted packet captures.
3. Include sanitized reproduction steps and offline tests with all code changes. Specify iOS and Shadowrocket version for any device-validated claim.
4. Avoid mutable remote JS URLs, public configuration endpoints, arbitrary model endpoints, and broad MITM rules.
5. Retain the upstream MIT license and boitar attribution. See LICENSE and README.
6. Report security concerns without sharing secrets or personal content.

Run locally:

    node --check scripts/sairs_router.js
    node tests/node_harness.js

The GitHub Actions workflow tests JavaScript-level behavior; it **does not** prove client rules, mock responses, or Siri SSE compatibility on iOS.
