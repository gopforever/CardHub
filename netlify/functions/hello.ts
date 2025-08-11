import type { Handler } from '@netlify/functions'

export const handler: Handler = async () => {
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ok: true,
      message: 'Hello from Netlify Functions 👋',
      time: new Date().toISOString()
    })
  }
}
