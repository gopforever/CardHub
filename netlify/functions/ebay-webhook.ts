import type { Handler } from '@netlify/functions'
import crypto from 'crypto'

/**
 * eBay Event Notification Delivery Method (Marketplace account deletion/closure)
 * Challenge handshake: respond with SHA256(challengeCode + verificationToken + endpoint)
 * where:
 *  - challengeCode: query param "challenge_code"
 *  - verificationToken: the shared token you set in eBay's portal AND as EBAY_VERIFICATION_TOKEN
 *  - endpoint: the exact https URL eBay calls (set as EBAY_WEBHOOK_ENDPOINT)
 *
 * Set these in Netlify environment variables:
 *  - EBAY_VERIFICATION_TOKEN   (string, required)
 *  - EBAY_WEBHOOK_ENDPOINT     (string, required, e.g. https://<site>.netlify.app/.netlify/functions/ebay-webhook)
 */

const TOKEN = process.env.EBAY_VERIFICATION_TOKEN || ""
const ENDPOINT = process.env.EBAY_WEBHOOK_ENDPOINT || ""

function challengeResponse(challenge: string, token: string, endpoint: string) {
  return crypto.createHash('sha256')
    .update(challenge + token + endpoint)
    .digest('hex')
}

export const handler: Handler = async (event) => {
  try {
    // 1) Challenge handshake
    if (event.httpMethod === 'GET' && event.queryStringParameters?.challenge_code) {
      const challenge = String(event.queryStringParameters.challenge_code || "")
      if (!TOKEN || !ENDPOINT) {
        console.error("Missing EBAY_VERIFICATION_TOKEN or EBAY_WEBHOOK_ENDPOINT env vars")
        return {
          statusCode: 500,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ error: 'Server not configured for eBay challenge' })
        }
      }
      const challengeResp = challengeResponse(challenge, TOKEN, ENDPOINT)
      return {
        statusCode: 200,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ challengeResponse: challengeResp })
      }
    }

    // 2) Real notifications (POST). Ack quickly with 200.
    // You can verify signatures here if you enable Notification API keys (X-EBAY-SIGNATURE).
    // For now we just log the payload for debugging.
    if (event.httpMethod === 'POST') {
      console.log('eBay notification headers:', JSON.stringify(event.headers))
      console.log('eBay notification body:', event.body)
      return { statusCode: 200, body: '' }
    }

    // 3) Anything else
    return { statusCode: 405, body: 'Method Not Allowed' }
  } catch (err: any) {
    console.error('Webhook error:', err?.message || err)
    return { statusCode: 500, body: 'Internal Server Error' }
  }
}

export default handler
