CardHub – Full Merge (Pricing + Media/Details + UX wins + TS build fix)

This package restores the full pricing UI while keeping the Netlify TypeScript fix.

Included:
- tsconfig.json → app-only type checking (includes DOM libs; excludes netlify/)
- netlify/functions/prices.ts → mock pricing API with 10‑min TTL cache, GET/POST
- .env.example → placeholder for PRICE_API_KEY (optional header auth)
- src/App.tsx → full UI:
  • Image thumbnails with safe fallback
  • Notes, Purchase price, ROI/Profit per row
  • Density toggle (Compact/Comfortable) saved in localStorage
  • CSV import/export extended (image, purchasePrice, notes). Dedupe on import.
  • Price cache in localStorage + “price age” chip (stale after 10m)
  • Batch “Refresh Prices” and per-row refresh with shimmers
  • Typed image onError handler (TS safe)

How to apply
1) Unzip into your repo root (preserve paths). Overwrite existing files when asked.
2) Commit & push. Netlify will redeploy.
3) On the site: add cards → hit “Refresh Prices” or per-row “Refresh”.
4) (Optional) In Netlify → Site settings → Environment:
   - Set PRICE_API_KEY to a value, then call the function with header x-price-key matching it.

CSV columns
name,set,number,condition,qty,image,purchasePrice,notes
(Older CSVs without the extra fields still import correctly.)
