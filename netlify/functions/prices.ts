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

type EbayPass = { keywords: string; status?: number; ack?: string; count?: number }

async function ebaySoldMedian(keywords: string, appId: string): Promise<{ price: number | null; count: number; status: number; ack: string }> {
  try {
    const endpoint = 'https://svcs.ebay.com/services/search/FindingService/v1'
    const params = new URLSearchParams({
      'OPERATION-NAME': 'findCompletedItems',
      'SERVICE-VERSION': '1.13.0',
      'SECURITY-APPNAME': appId,
      'RESPONSE-DATA-FORMAT': 'JSON',
      'REST-PAYLOAD': 'true',
      'GLOBAL-ID': 'EBAY-US',
      'keywords': keywords,
      'paginationInput.entriesPerPage': '50',
      // Only SOLD completed listings
      'itemFilter(0).name': 'SoldItemsOnly',
      'itemFilter(0).value': 'true'
    })
    const res = await fetch(`${endpoint}?${params.toString()}`, { method: 'GET', headers: { 'Accept': 'application/json' } })
    const status = res.status
    if (!res.ok) return { price: null, count: 0, status, ack: 'HTTP ' + status }
    const data = await res.json() as any
    const ack = data?.findCompletedItemsResponse?.[0]?.ack?.[0] ?? 'Unknown'
    if (ack !== 'Success') return { price: null, count: 0, status, ack }
    const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || []
    const prices: number[] = []
    for (const it of items) {
      const priceStr = it?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ ?? it?.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__
      const p = priceStr != null ? Number(priceStr) : NaN
      if (Number.isFinite(p)) prices.push(p)
    }
    return { price: median(prices), count: prices.length, status, ack }
  } catch (e: any) {
    return { price: null, count: 0, status: 0, ack: e?.message || 'error' }
  }
}

function buildKeywordPasses(i: ItemIn): string[] {
  const base = [i.name, i.set, i.number, (i.condition && i.condition !== 'Raw') ? i.condition : '']
    .filter((x) => !!x && String(x).trim().length > 0)
    .map((x) => String(x).trim())
  // Pass 1: full (no '#')
  const p1 = base.join(' ')
  // Pass 2: drop condition (sometimes hurts matches)
  const p2 = [i.name, i.set, i.number].filter(Boolean).join(' ')
  // Pass 3: name + number only
  const p3 = [i.name, i.number].filter(Boolean).join(' ')
  // Deduplicate and keep non-empty
  const set = new Set([p1, p2, p3].map((s) => s.trim()).filter((s) => s.length > 0))
  return Array.from(set)
}

async function getLiveQuote(i: ItemIn, debug: boolean): Promise<{ price: number | null; count: number; passes?: EbayPass[] } | null> {
  const appId = process.env.EBAY_APP_ID
  if (!appId) return debug ? { price: null, count: 0, passes: [] } : null
  const tries = buildKeywordPasses(i)
  const passes: EbayPass[] = []
  for (const kw of tries) {
    const r = await ebaySoldMedian(kw, appId)
    passes.push({ keywords: kw, status: r.status, ack: r.ack, count: r.count })
    if (r.price != null && r.count > 0) {
      return debug ? { price: r.price, count: r.count, passes } : { price: r.price, count: r.count }
    }
  }
  return debug ? { price: null, count: 0, passes } : { price: null, count: 0 }
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

async function quoteFor(i: ItemIn, debug: boolean): Promise<{ q: Quote | null; meta?: any }> {
  const sig = sigOf(i)
  const cached = MEM.map!.get(sig)
  const now = Date.now()
  if (cached && cached.exp > now) {
    const q = { id: i.id, price: cached.price, at: cached.at, source: cached.source, count: cached.count }
    return { q, meta: debug ? { cached: true } : undefined }
  }

  let source: 'ebay-sold' | 'mock' = 'mock'
  let count = 0
  let price: number | null = null

  const live = await getLiveQuote(i, debug)
  const meta: any = debug ? { appIdPresent: !!process.env.EBAY_APP_ID, passes: live?.passes ?? [] } : undefined
  if (live && live.price != null && live.count > 0) {
    price = live.price
    count = live.count
    source = 'ebay-sold'
  } else {
    price = mockFromSig(sig)
  }

  const at = nowISO()
  MEM.map!.set(sig, { price, at, exp: now + TEN_MIN, source, count })
  const q = { id: i.id, price, at, source, count }
  return { q, meta }
}

export const handler: Handler = async (event) => {
  const debug = event.queryStringParameters?.debug === '1'

  if (event.httpMethod === 'GET') {
    const { name = '', set = '', number = '', condition = '' } = event.queryStringParameters || {}
    if (!String(name).trim()) return bad(400, 'name is required')

    const item: ItemIn = { name: String(name), set: String(set), number: String(number), condition: String(condition) }
    const { q, meta } = await quoteFor(item, debug)
    return ok({ ok: true, quote: q, ...(debug ? { meta } : {}) })
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = event.body ? JSON.parse(event.body) : {}
      const items = Array.isArray(body?.items) ? body.items as ItemIn[] : []
      if (!items.length) return bad(400, 'items required')

      const out: Quote[] = []
      const metaAll: any[] = []
      for (const it of items) {
        const { q, meta } = await quoteFor(it, debug)
        if (q) out.push(q)
        if (debug) metaAll.push(meta)
      }
      return ok({ ok: true, quotes: out, ...(debug ? { meta: metaAll } : {}) })
    } catch {
      return ok({ ok: true, quotes: [] })
    }
  }

  return bad(405, 'Method not allowed')
}

export default handler
