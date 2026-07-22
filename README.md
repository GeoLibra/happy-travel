[https://f12026shanghai.vercel.app/](https://f12026shanghai.vercel.app/)

## CI/CD and verification

- `CI` runs on PRs and `main` pushes: deterministic `check:*` scripts, TypeScript, and production build.
- `Showroom Browser Acceptance` runs only when showroom/F1/browser-relevant files change, or manually from GitHub Actions. It uses Chromium desktop plus Chromium mobile viewport emulation; this is not a physical mobile device or real Safari/WebKit.
- Vercel deployment is handled by Vercel Git Integration: PR/non-production branches create Preview deployments, and `main` creates Production deployments after GitHub checks.
- Local browser evidence: `npm run check:showroom-acceptance`. Screenshots and JSON are written to ignored `output/playwright/`.

<img width="1511" height="734" alt="Screenshot 2026-05-22 at 11 01 50 AM" src="https://github.com/user-attachments/assets/4c13599d-7bac-4a9b-9982-66926ce0ec8e" />
<img width="3024" height="1492" alt="image" src="https://github.com/user-attachments/assets/49a6d995-4b4d-476f-81ca-4c826724a194" />
<img width="3024" height="1496" alt="image" src="https://github.com/user-attachments/assets/df2eb00d-8c0c-49c7-8dcf-8d7c721caa5c" />
<img width="3024" height="1494" alt="image" src="https://github.com/user-attachments/assets/ed4a1094-31f4-44f5-85c1-bf986795fdc3" />
