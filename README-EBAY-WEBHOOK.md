# eBay Event Notification Delivery Method — Netlify Function

This function completes eBay's **challenge/response handshake** for the Marketplace account deletion/closure notices and then accepts live notifications.

## Files
- `netlify/functions/ebay-webhook.ts` — the function

## Configure on Netlify
1. Go to **Site → Settings → Environment variables** and add:
   - `EBAY_VERIFICATION_TOKEN` — a secret string you will also paste into eBay’s UI.
   - `EBAY_WEBHOOK_ENDPOINT` — the **exact** public HTTPS URL to this function, e.g.  
     `https://<your-site>.netlify.app/.netlify/functions/ebay-webhook`
2. Deploy your site so these env vars are available to the function.

> Tip: If you manage Node versions, you can pin in `netlify.toml`:
> ```toml
> [build.environment]
> NODE_VERSION = "20.19.4"
> ```

## Register in eBay (Developer Portal)
- Open your **Application Keys → Alerts and Notifications**.
- Under **Event Notification Delivery Method**, select **Marketplace account deletion**.
- Provide:
  - **Notification Endpoint URL** = the same URL you set in `EBAY_WEBHOOK_ENDPOINT`
  - **Verification token** = the same value as `EBAY_VERIFICATION_TOKEN`
  - Contact email
- Save — eBay immediately calls `GET ?challenge_code=...`.
- Our function returns `{ "challengeResponse": "<sha256>" }` using: `challengeCode + verificationToken + endpoint`.

## Local test (simulate handshake)
Replace values and run a GET request against production (since eBay requires public HTTPS):

```
curl -s "https://<your-site>.netlify.app/.netlify/functions/ebay-webhook?challenge_code=TEST123"
```

If env vars are set, you’ll get a JSON response with `challengeResponse`.
(For a true match, use the same challenge string and exact endpoint that eBay will send/use.)

## Receiving notifications
eBay will POST JSON to the same URL. We `200 OK` immediately and log the body.  
Extend the handler to store or act on events as needed.

## Optional: Signature verification
eBay can include `X-EBAY-SIGNATURE`. To verify:
1) Use eBay’s Notification API to fetch the public key for the `kid` in the signature header.  
2) Verify the JWS/JWT signature against the request body.  
This sample leaves verification as a TODO, but the hook is where the POST is handled.
