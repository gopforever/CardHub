import type { Handler } from '@netlify/functions'

// In-memory cache per lambda instance
type CacheVal = { price: number; at: string; exp: number }
const MEM: { map?: Map<string, CacheVal> } = (globalThis as any).__ct_price_mem || {}
if (!MEM.map) MEM.map = new Map<string, CacheVal>()
;(globalThis as any).__ct_price_mem = MEM

const TEN_MIN = 10 * 60 * 1000

type ItemIn = { id?: string; name: string; set?: string; number?: string; condition?: string }
type Quote = { id?: string; price: number; at: string }

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

async function ebaySoldMedian(keywords: string, appId: string): Promise<number | null> {
  const endpoint = 'https://svcs.ebay.com/services/search/FindingService/v1'
  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.13.0',
    'SECURITY-APPNAME': appId,
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': 'true',
    'keywords': keywords,
    'paginationInput.entriesPerPage': '50',
    'outputSelector': 'SellerInfo',
    // Only sold (not just completed)
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true'
  })

  const res = await fetch(`${endpoint}?${params.toString()}`, {
    method: 'GET',
    headers: { 'Accept': 'application/json' }
  })

  if (!res.ok) throw new Error(`eBay HTTP ${res.status}`)
  const data = await res.json() as any
  const ack = data?.findCompletedItemsResponse?.[0]?.ack?.[0]
  if (ack !== 'Success') throw new Error('eBay: non-success ack')

  const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || []
  const prices: number[] = []
  for (const it of items) {
    const priceStr = it?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ ?? it?.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__
    const p = priceStr != null ? Number(priceStr) : NaN
    if (Number.isFinite(p)) prices.push(p)
  }
  return median(prices)
}

async function getLivePrice(i: ItemIn): Promise<number | null> {
  const appId = process.env.EBAY_APP_ID
  if (!appId) return null // No key => let caller decide fallback

  // Build simple keywords string
  const keywords = [
    i.name,
    i.set,
    i.number ? `#${i.number}` : '',
    i.condition && i.condition !== 'Raw' ? i.condition : ''
  ].filter(Boolean).join(' ').trim()

  if (!keywords) return null
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
function err(statusCode: number, message: string){
  return {
    statusCode,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ok: false, error: message })
  }
}

async function quoteFor(i: ItemIn): Promise<Quote | null> {
  const sig = sigOf(i)
  const cached = MEM.map!.get(sig)
  const now = Date.now()
  if (cached && cached.exp > now) {
    return { id: i.id, price: cached.price, at: cached.at }
  }

  // Try live price
  let price = await getLivePrice(i)
  if (price == null) {
    // Fallback mock if no key or no comps
    // Deterministic-ish hash-based mock so it is stable per item signature
    let hash = 0
    for (let c of sig) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0
    const base = Math.abs(hash % 2000) / 10 + 1 // 1.0 .. 200.0
    price = Math.round(base * 100) / 100
  }

  const at = nowISO()
  MEM.map!.set(sig, { price, at, exp: now + TEN_MIN })
  return { id: i.id, price, at }
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod === 'GET') {
      const { name = '', set = '', number = '', condition = '' } = event.queryStringParameters || {}
      if (!String(name).trim()) return err(400, 'name is required')

      const item: ItemIn = { name: String(name), set: String(set), number: String(number), condition: String(condition) }
      const q = await quoteFor(item)
      return ok({ ok: true, quote: q })
    }

    if (event.httpMethod === 'POST') {
      const body = event.body ? JSON.parse(event.body) : {}
      const items = Array.isArray(body?.items) ? body.items as ItemIn[] : []
      if (!items.length) return err(400, 'items required')

      const out: Quote[] = []
      for (const it of items) {
        const q = await quoteFor(it)
        if (q) out.push(q)
      }
      return ok({ ok: true, quotes: out })
    }

    return err(405, 'Method not allowed')
  } catch (e: any) {
    return err(500, e?.message || 'Internal error')
  }
}

export default handler
