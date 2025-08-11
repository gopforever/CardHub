CardHub – Media & Details Pack

What’s new
- Thumbnail column: optional per-card Image URL with safe fallback graphic
- Purchase price (per unit) + per-row ROI and profit
- Notes field on each card (visible on edit; optional in add form)
- Density toggle (Comfortable / Compact) stored in localStorage
- CSV updated: headers now include image, purchasePrice, notes (import/export)
- JSON backup/restore updated to include new fields

How to use
1) Unzip into your repo root, overwriting `src/App.tsx`.
2) Commit & push to trigger Netlify.
3) Add or edit a card:
   - (optional) paste an Image URL (any public image)
   - (optional) set Purchase $ (per-card cost)
   - (optional) add Notes
4) Click Refresh Prices or per-row Refresh to compute ROI.
5) Toggle density in the toolbar (top-right of My Collection).

CSV columns
name,set,number,condition,qty,image,purchasePrice,notes
(Older CSVs still import; missing fields default sensibly.)
