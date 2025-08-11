import type { Handler } from '@netlify/functions'

type ReqItem = { id?: string; name: string; set: string; number: string; condition?: string }
type Quote = { id?: string; price: number; currency: 'USD'; ttlSeconds: number; at: string; source: 'mock' }

const TTL_MS = 10 * 60 * 1000
const MAX_CACHE = 500
type CacheEntry = { price: number; expires: number }
const cache = new Map<string, CacheEntry>()

function cacheGet(key: string): number | null {
  const hit = cache.get(key); if (!hit) return null
  if (Date.now() > hit.expires) { cache.delete(key); return null }
  return hit.price
}
function cacheSet(key: string, price: number) {
  if (cache.size > MAX_CACHE) { const first = cache.keys().next().value; if (first) cache.delete(first) }
  cache.set(key, { price, expires: Date.now() + TTL_MS })
}

function mulberry32(a: number) { return function(){ let t=(a+=0x6D2B79F5); t=Math.imul(t^(t>>>15),t|1); t^=t+Math.imul(t^(t>>>7),t|61); return ((t^(t>>>14))>>>0)/4294967296 } }
function strHash(s: string){ let h=2166136261>>>0; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619) } return h>>>0 }
function mockPrice(name: string, set: string, num: string, condition?: string): number {
  const key = `${name}|${set}|${num}`.toLowerCase()
  const rng = mulberry32(strHash(key))
  const base = 0.25 + rng() * 149.75
  const cond = (condition || 'Raw').toUpperCase()
  const mult = cond.includes('PSA 10') ? 3 : cond.includes('BGS 9.5') ? 2.5 : cond.includes('PSA 9') ? 2 : cond.includes('RAW') ? 1 : 1.2
  return Math.max(0.25, Math.round(base * mult * 100) / 100)
}

function checkKey(headers: Record<string, string | undefined>): { ok: boolean; error?: string } {
  const required = process.env.PRICE_API_KEY
  if (!required) return { ok: true }
  const provided = headers['x-price-key'] || headers['X-Price-Key'] || headers['x-price-key'.toLowerCase()]
  if (!provided || provided !== required) return { ok: false, error: 'Unauthorized' }
  return { ok: true }
}

export const handler: Handler = async (event) => {
  const auth = checkKey(event.headers as any)
  if (!auth.ok) return { statusCode: 401, body: JSON.stringify({ error: auth.error }) }

  const now = new Date().toISOString()
  const headers = { 'content-type': 'application/json', 'cache-control': 'no-store' }

  if (event.httpMethod === 'POST') {
    try {
      const body = JSON.parse(event.body || '{}') as { items?: ReqItem[] }
      const items = Array.isArray(body.items) ? body.items : []
      if (!items.length) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing items' }) }
      const quotes: Quote[] = items.map((it) => {
        const key = `${(it.name||'').trim()}|${(it.set||'').trim()}|${(it.number||'').trim()}|${(it.condition||'Raw').trim()}`
        let price = cacheGet(key); if (price == null) { price = mockPrice(it.name||'', it.set||'', it.number||'', it.condition); cacheSet(key, price) }
        return { id: it.id, price, currency: 'USD', ttlSeconds: TTL_MS / 1000, at: now, source: 'mock' }
      })
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true, quotes }) }
    } catch {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }
    }
  }

  const params = event.queryStringParameters || {}
  const name = (params.name || '').toString()
  const set = (params.set || '').toString()
  const number = (params.number || '').toString()
  const condition = (params.condition || '').toString()
  if (!name && !set && !number) return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provide name/set/number or POST items[]' }) }
  const key = `${name}|${set}|${number}|${condition||'Raw'}`
  let price = cacheGet(key); if (price == null) { price = mockPrice(name, set, number, condition); cacheSet(key, price) }
  const out: Quote = { price, currency: 'USD', ttlSeconds: TTL_MS / 1000, at: now, source: 'mock' }
  return { statusCode: 200, headers, body: JSON.stringify({ ok: true, quote: out }) }
}
