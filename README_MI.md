# CardHub — eBay Marketplace Insights (Sold Prices)

This patch switches pricing to **eBay Marketplace Insights** (sold/completed listings) using **OAuth Client Credentials**.

## Files
- `netlify/functions/prices.ts` — calls `GET /buy/marketplace_insights/v1_beta/item_sales/search?q=` with a Bearer token.
  - Computes a **median** of `lastSoldPrice.value` (fallback to `price.value`) from up to 50 results.
  - 10‑minute in‑memory cache per lambda instance.
  - Graceful fallback to **Mock** when MI isn't accessible.

## Netlify env (Production scope)
- `EBAY_CLIENT_ID` = your eBay **Client ID** (App ID)
- `EBAY_CLIENT_SECRET` = your eBay **Client Secret**
- *(optional)* `EBAY_ENV` = `production` or `sandbox` (default `production`)
- *(optional)* `EBAY_MI_SCOPE` if you need to override scopes. Default used:
  ```
  https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/buy.marketplace.insights
  ```

## Test (in production site)
```
/.netlify/functions/prices?name=Shohei%20Ohtani&set=Topps%20Chrome&number=1&debug=1
```
Look for:
- `quote.source: "ebay-mi"` and `count > 0` → ✅ live sold comps
- `meta.mi.status` **200** with `count > 0` → ✅
- If you see `oauth-...` in `meta.mi.bodyHint` → check credentials/scopes
- If `status` is **403/401** → usually missing/insufficient scopes or restricted API
- If `status` is **429** → rate limit (add small delays between bulk calls)

## Notes
- Marketplace Insights is a **restricted Buy API**; many accounts require approval. If your token is minted but the call returns 403, request access via eBay’s **Application Growth Check**.
- You can add a date filter to focus on recent sales, e.g. last 90 days:
  `filter=lastSoldDate:[2025-05-14T00:00:00Z..2025-08-12T00:00:00Z]`
  (Wire this in if you want — see `miSearchSold` comment.)
