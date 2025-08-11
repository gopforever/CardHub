CardHub – Fixed package.json

What this is
- A clean, valid package.json with corrected scripts and typical dependencies for Vite + React + TypeScript.

How to use
1) Back up your existing package.json.
2) Replace it with this one (or copy the "scripts" block if you prefer not to change deps).
3) Run: npm install
4) Commit & push to trigger Netlify.

Build scripts (now valid JSON)
  "typecheck": "tsc --noEmit -p tsconfig.json"
  "build": "npm run typecheck && vite build"
  "dev": "vite"
  "preview": "vite preview"

Note
- If your project has extra deps, re-add them after step 3 (npm i <pkg> --save/--save-dev).
- This file assumes you already have tsconfig.json configured for app-only type-checking.
