# GitHub Pages: Main + Agentic Branches

## Live URLs
- Main (Agentic): https://dsvikstrand.github.io/remix-of-stackwise-advisor/
- Lovable (legacy): https://dsvikstrand.github.io/remix-of-stackwise-advisor/lovable-backend/

## Branch Mapping
- `main` (agentic) builds to the root of `gh-pages`.
- `lovable-main` (legacy) builds to `gh-pages/lovable-backend/`.

## How It Works
- The workflow builds with `VITE_BASE_PATH` to set the correct base URL per branch.
- `public/404.html` + a small script in `index.html` handle SPA deep links (e.g., `/wall`).

## Required GitHub Pages Setting
- Settings → Pages → **Deploy from a branch**
- Branch: `gh-pages`
- Folder: `/ (root)`

## Troubleshooting
- **404 on `/lovable-backend/*`**: `main` build not deployed yet or workflow still using old base path.
- **`npm ci` fails**: update lockfile with `npm install --package-lock-only` and commit `package-lock.json`.
- **Deep links 404**: confirm `public/404.html` exists and is deployed for both branches.
