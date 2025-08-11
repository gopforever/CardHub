import type { Handler } from '@netlify/functions'

// In-memory cache per lambda instance
type CacheVal = { price: number; at: string; exp: number; source: 'ebay-sold' | 'mock'; count?: number }
const MEM: { map?: Map<string, CacheVal> } = (globalThis as any).__ct_price_mem || {}
if (!MEM.map) MEM.map = new Map<string, CacheVal>()
;(globalThis as any).__ct_price_mem = MEM

const TEN_MIN = 10 * 60 * 1000

type ItemIn = { id?: string; name: string; set?: string; number?: string; condition?: string }
type Quote = { id?: string; price: number; at: string; source: 'ebay-sold' | 'mock'; count?: number }

function sigOf(i: ItemIn): string {
  const parts = [i.name, i.set || '', i.number || '', i.condition || 'Raw']
  return parts.map((s) => String(s || '').trim().toLowerCase()).join('|')
}

function median(nums: number[]): number | null {
  const arr = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b)
  if (!arr.length) return null
  const mid = Math.floor(arr.length / 2)
  return arr.length % 2 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2
}

async function ebaySoldMedian(keywords: string, appId: string): Promise<{ price: number | null; count: number }> {
  try {
    const endpoint = 'https://svcs.ebay.com/services/search/FindingService/v1'
    const params = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SERVICE-VERSION': '1.13.0',
      'SECURITY-APPNAME': appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': 'true',
      'keywords': keywords,
      'paginationInput.entriesPerPage': '50',
      // Only SOLD completed listings
      'itemFilter(0).name': 'SoldItemsOnly',
      'itemFilter(0).value': 'true'
    })
    const res = await fetch(`${endpoint}?${params.toString()}`, { method: 'GET', headers: { 'Accept': 'application/json' } })
    if (!res.ok) return { price: null, count: 0 }
    const data = await res.json() as any
    const ack = data?.findCompletedItemsResponse?.[0]?.ack?.[0]
    if (ack !== 'Success') return { price: null, count: 0 }
    const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || []
    const prices: number[] = []
    for (const it of items) {
      const priceStr = it?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ ?? it?.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__
      const p = priceStr != null ? Number(priceStr) : NaN
      if (Number.isFinite(p)) prices.push(p)
    }
    return { price: median(prices), count: prices.length }
  } catch {
    return { price: null, count: 0 }
  }
}

async function getLiveQuote(i: ItemIn): Promise<{ price: number | null; count: number } | null> {
  const appId = process.env.EBAY_APP_ID
  if (!appId) return null // No key => caller will decide fallback
  const keywords = [
    i.name,
    i.set,
    i.number ? `#${i.number}` : '',
    i.condition && i.condition !== 'Raw' ? i.condition : ''
  ].filter(Boolean).join(' ').trim()
  if (!keywords) return { price: null, count: 0 }
  return ebaySoldMedian(keywords, appId)
}

function nowISO(){ return new Date().toISOString() }

function ok(body: any){
  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    body: JSON.stringify(body)
  }
}
function bad(statusCode: number, message: string){
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: false, error: message })
  }
}

function mockFromSig(sig: string){
  let hash = 0
  for (let c of sig) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0
  const base = Math.abs(hash % 2000) / 10 + 1 // 1.0 .. 200.0
  return Math.round(base * 100) / 100
}

async function quoteFor(i: ItemIn): Promise<Quote | null> {
  const sig = sigOf(i)
  const cached = MEM.map!.get(sig)
  const now = Date.now()
  if (cached && cached.exp > now) {
    return { id: i.id, price: cached.price, at: cached.at, source: cached.source, count: cached.count }
  }

  let source: 'ebay-sold' | 'mock' = 'mock'
  let count = 0
  let price: number | null = null

  const live = await getLiveQuote(i)
  if (live && live.price != null && live.count > 0) {
    price = live.price
    count = live.count
    source = 'ebay-sold'
  } else {
    price = mockFromSig(sig)
  }

  const at = nowISO()
  MEM.map!.set(sig, { price, at, exp: now + TEN_MIN, source, count })
  return { id: i.id, price, at, source, count }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'GET') {
    const { name = '', set = '', number = '', condition = '' } = event.queryStringParameters || {}
    if (!String(name).trim()) return bad(400, 'name is required')

    const item: ItemIn = { name: String(name), set: String(set), number: String(number), condition: String(condition) }
    const q = await quoteFor(item)
    return ok({ ok: true, quote: q })
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = event.body ? JSON.parse(event.body) : {}
      const items = Array.isArray(body?.items) ? body.items as ItemIn[] : []
      if (!items.length) return bad(400, 'items required')

      const out: Quote[] = []
      for (const it of items) {
        const q = await quoteFor(it)
        if (q) out.push(q)
      }
      return ok({ ok: true, quotes: out })
    } catch {
      return ok({ ok: true, quotes: [] })
    }
  }

  return bad(405, 'Method not allowed')
}

export default handler
