[https://f12026shanghai.vercel.app/](https://f12026shanghai.vercel.app/)

## CI/CD and verification

- Package manager: `pnpm` (lockfile `pnpm-lock.yaml`).
- `CI` runs on PRs and `main` pushes: `pnpm test:fast` (deterministic checks, TypeScript, Vitest unit tests, asset verification, production build).
- Container environment in CI uses official Playwright docker image `mcr.microsoft.com/playwright:v1.61.1-jammy`.
- `Showroom Browser Acceptance` runs when showroom/F1/browser-relevant files change or manually via `pnpm test:impact` or GitHub Actions.
- Vercel deployment is handled by Vercel Git Integration: PR/non-production branches create Preview deployments, and `main` creates Production deployments after GitHub checks.
- Standard commands:
  - `pnpm test:fast`: Fast local quality gate (lint, unit, assets, build).
  - `pnpm test:assets`: Specialized asset validation checks.
  - `pnpm test:impact`: Affected Playwright browser suite execution.
  - `pnpm test:e2e`: Full browser E2E test matrix.
  - `pnpm check:showroom-acceptance`: Local browser evidence generation (written to ignored `output/playwright/`).
- Detailed CI/CD references live in [docs/superpowers/specs/2026-07-21-ci-cd-testing-platform-design.md](docs/superpowers/specs/2026-07-21-ci-cd-testing-platform-design.md) and [docs/superpowers/plans/2026-07-21-ci-cd-testing-platform.md](docs/superpowers/plans/2026-07-21-ci-cd-testing-platform.md).

<img width="1511" height="734" alt="Screenshot 2026-05-22 at 11 01 50 AM" src="https://github.com/user-attachments/assets/4c13599d-7bac-4a9b-9982-66926ce0ec8e" />
<img width="3024" height="1492" alt="image" src="https://github.com/user-attachments/assets/49a6d995-4b4d-476f-81ca-4c826724a194" />
<img width="3024" height="1496" alt="image" src="https://github.com/user-attachments/assets/df2eb00d-8c0c-49c7-8dcf-8d7c721caa5c" />
<img width="3024" height="1494" alt="image" src="https://github.com/user-attachments/assets/ed4a1094-31f4-44f5-85c1-bf986795fdc3" />
