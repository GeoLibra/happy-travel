# Happy Travel agent guidance

Happy Travel is a React, TypeScript, and Three.js trip planner for the 2026 Shanghai race weekend, with an F1 showroom welcome experience and a map/list itinerary.

## Toolchain

- Use `pnpm`; the repository pins it in `package.json` and commits `pnpm-lock.yaml`.
- Use Node.js 24 locally and in CI. Do not downgrade it to work around tooling issues without explicit approval.
- Run `pnpm test:fast` for the main local quality gate (typecheck, unit tests, project resolver, asset validation, and build).
- Use the more focused or browser-heavy gates described in [docs/testing/ci-testing-policy.md](docs/testing/ci-testing-policy.md) when the changed area requires them.

## Task-specific guidance

Load detailed guidance only when it applies to the task:

- For the F1 welcome scene, showroom behavior, car assets, WebGL lifecycle, or related browser evidence, follow [docs/agent-guides/f1-showroom.md](docs/agent-guides/f1-showroom.md).
- For test selection, Playwright, CI, memory checks, and artifact conventions, follow [docs/testing/ci-testing-policy.md](docs/testing/ci-testing-policy.md).
- For showroom browser evidence and its output, follow [docs/showroom-browser-acceptance.md](docs/showroom-browser-acceptance.md).

Canonical implementation plans and design specs belong under `docs/superpowers/**` in the main checkout. Treat `.worktrees/**` and `output/**` as disposable execution artifacts, not long-term sources of truth.
