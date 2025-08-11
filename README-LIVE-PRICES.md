# Live Prices via eBay (findCompletedItems)

This function replaces the mock pricing with real **median sold prices** from eBay's Finding API.
If the `EBAY_APP_ID` environment variable is not set (or no comps found), it gracefully falls back to the previous mock.

## Setup (Netlify)

1. Go to **Site → Settings → Environment variables**.
2. Add a variable: `EBAY_APP_ID = <your eBay AppID (Client ID)>`.
3. Redeploy.

_Optional:_ Pin Node in `netlify.toml`

```toml
[build.environment]
NODE_VERSION = "20.19.4"
```

## Endpoints

- `GET /.netlify/functions/prices?name=...&set=...&number=...&condition=Raw`
- `POST /.netlify/functions/prices`
  ```json
  { "items": [{ "id": "row-1", "name": "Shohei Ohtani", "set": "Topps Chrome", "number": "1", "condition": "PSA 10" }] }
  ```

**Response**
```json
{ "ok": true, "quote": { "price": 23.45, "at": "2025-08-11T21:30:00.000Z" } }
```
or
```json
{ "ok": true, "quotes": [{ "id": "row-1", "price": 23.45, "at": "2025-08-11T21:30:00.000Z" }] }
```

## Notes

- We compute a median of up to the last 50 SOLD listings' final prices.
- Simple in-function memory cache (10 min TTL) + your app's localStorage cache keep things snappy.
- Keywords are built from `name`, `set`, `#number`, and `condition` (if not "Raw").
- If you want to restrict by category, you can add `&categoryId=<id>` to the `params` construction.
