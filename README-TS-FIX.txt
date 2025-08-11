CardHub – Netlify TypeScript Build Fix

What this does
- Replaces your root tsconfig.json so CI type-checks ONLY the React app (src/**), excludes netlify/functions.
- Adds proper DOM libs so browser APIs (e.g., crypto.randomUUID, Image onError) type-check.
- Updates src/App.tsx to use a typed image onError handler (no implicit any).

How to apply
1) Copy the files in this zip into your repo root (preserving paths).
2) Commit & push. Netlify will redeploy.
   - Your existing package.json script (tsc -b && vite build) will now succeed,
     because tsconfig excludes serverless code.
3) Optional: For local function type-checking, run: `npx tsc --noEmit -p netlify/tsconfig.json`

Notes
- If you previously customized tsconfig.json, back it up before replacing.
- If you still prefer separate configs, you can change your build script to:
    "typecheck": "tsc --noEmit -p tsconfig.app.json",
    "build": "npm run typecheck && vite build"
  and create tsconfig.app.json (same content as this tsconfig.json).
