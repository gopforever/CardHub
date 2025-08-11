CardHub – Pricing Pipeline Scaffold

Files included:
- src/App.tsx                      (UI: price column, totals, refresh button, toasts w/ animations)
- netlify/functions/prices.ts      (mock pricing + 10min TTL cache, POST batch)
- .env.example                     (placeholder for PRICE_API_KEY)

How to apply:
1) Drop these files into your repo root, preserving paths (src/, netlify/).
2) Commit and push. Netlify will redeploy automatically.
3) On the live site, open "My Collection" and click "Refresh Prices".

Optional:
- In Netlify → Site settings → Environment, set PRICE_API_KEY to enable header-based auth.
