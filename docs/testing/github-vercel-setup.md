# GitHub Actions & Vercel Setup Checklist

This document describes the remote repository protection, GitHub Actions workflow configuration, and Vercel Git Integration setup for `GeoLibra/happy-travel`.

---

## 1. Vercel Integration

- **Deployment Model**: Native Vercel Git Integration (Hobby Tier).
- **Preview Deployments**: Triggered automatically on Pull Request and non-main branch pushes.
- **Production Deployments**: Triggered automatically on pushes/merges to `main`.
- **SPA Routing**: Handled via `vercel.json` rewrite rule:
  ```json
  {
    "rewrites": [
      { "source": "/(.*)", "destination": "/index.html" }
    ]
  }
  ```
- **Environment Variables**: Production secrets (e.g. `GEMINI_API_KEY`) are managed exclusively in the Vercel dashboard. No Vercel tokens or credentials are required in GitHub Actions workflows.

---

## 2. GitHub Actions Workflows

1. **`ci.yml` (`CI`)**:
   - Triggers: `pull_request`, `push` to `main`, `workflow_dispatch`.
   - Environment: Container `mcr.microsoft.com/playwright:v1.61.1-jammy`.
   - Jobs: Fast Gate (`pnpm test:fast`), typecheck (`pnpm lint`), build (`pnpm build`).

2. **`showroom-browser-acceptance.yml` (`Showroom Browser Acceptance`)**:
   - Triggers: PRs, `main` pushes modifying showroom/F1 files, or manual dispatch.
   - Container: `mcr.microsoft.com/playwright:v1.61.1-jammy`.
   - Matrix: Dynamically resolved Playwright projects.

3. **`ci-visual-memory.yml` (`Visual & Memory Audit`)**:
   - Triggers: Nightly schedule (`0 3 * * *`) and `workflow_dispatch` with manual inputs:
     - `suite`: `visual`, `memory`, or `all`.
     - `domain`: `f1`, `particles`, `rose`, or `all`.
   - Container: `mcr.microsoft.com/playwright:v1.61.1-jammy`.

---

## 3. GitHub Repository Branch Protection (`main`)

Configure the following branch protection rules for `main` in GitHub Settings:

- [x] Require a pull request before merging
- [x] Require status checks to pass before merging:
  - `Typecheck, deterministic checks, unit tests, and build` (`quality-gate`)
  - `Showroom browser acceptance` (`showroom-browser-gate`)
- [x] Require branches to be up to date before merging
- [x] Do not allow bypassing the above settings
- [x] Restrict force pushes and branch deletions
