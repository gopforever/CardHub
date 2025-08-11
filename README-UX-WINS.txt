CardHub – Quick UX Wins

What’s included
- Updated src/App.tsx:
  • Price cache in localStorage with TTL (10 min)
  • “Price age” chip showing how fresh the quote is (+ stale indicator past TTL)
  • Per-row Refresh button with optimistic shimmer (no full-table spinner)
  • CSV import dedupe (same name/set/#/condition): merges quantities into existing rows and collapses duplicates within the CSV
- (Unchanged) netlify/functions/prices.ts for reference

How to use
1) Unzip into your repo root (preserve paths).
2) Commit & push; Netlify redeploys.
3) On My Collection: add a few cards, click Refresh Prices (batch) or per-row refresh.
4) Prices are cached by (name|set|number|condition) for 10 minutes. Editing a card reuses cached price if available.
