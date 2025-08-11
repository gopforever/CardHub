# Diagnostics for eBay pricing

This update improves match rates (multi-pass keyword search, no '#') and adds a **debug mode** to see why a quote fell back to Mock.

## Try a debug GET
```
/.netlify/functions/prices?name=Shohei%20Ohtani&set=Topps%20Chrome&number=1&condition=Raw&debug=1
```
You’ll get a `meta` block like:
```json
{
  "appIdPresent": true,
  "passes": [
    { "keywords": "Shohei Ohtani Topps Chrome 1", "status": 200, "ack": "Success", "count": 18 },
    { "keywords": "Shohei Ohtani Topps Chrome", "status": 200, "ack": "Success", "count": 42 }
  ]
}
```
If `appIdPresent` is `false`, your Netlify env var isn’t available to functions. Ensure `EBAY_APP_ID` is set for **Production** and redeploy.

## Changes
- Adds `GLOBAL-ID=EBAY-US`
- Multi-pass keywords: (name + set + number + condition) → then drop condition → then name + number
- Returns `{ source: 'ebay-sold' | 'mock', count }` as before
