import type { Handler } from '@netlify/functions'

/**
 * Rate-limit–safe pricing function.
 * - Single best keyword pass (reduces calls)
 * - Detects eBay RateLimiter (errorId 10001) and stops further attempts
 * - Optional per-call delay via EBAY_DELAY_MS (default 1100ms)
 * - Dedupes items in bulk POST
 * - Returns { limited: boolean } if any call hit the rate limiter
 */

type CacheVal = { price: number; at: string; exp: number; source: 'ebay-sold' | 'mock'; count?: number }
const MEM: { map?: Map<string, CacheVal> } = (globalThis as any).__ct_price_mem || {}
if (!MEM.map) MEM.map = new Map<string, CacheVal>()
;(globalThis as any).__ct_price_mem = MEM

const TEN_MIN = 10 * 60 * 1000
const DEFAULT_DELAY_MS = Number(process.env.EBAY_DELAY_MS || 1100)

type ItemIn = { id?: string; name: string; set?: string; number?: string; condition?: string }
type Quote = { id?: string; price: number; at: string; source: 'ebay-sold' | 'mock'; count?: number }
type Diag = { status: number; ack: string; count: number; limited?: boolean; bodyHint?: string }

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

function bestKeywords(i: ItemIn): string {
  // Most successful for comps: name + set + number (no '#' and no condition)
  const base = [i.name, i.set, i.number].filter(Boolean).map((s)=>String(s).trim())
  return base.join(' ')
}

async function ebayFindCompleted(keywords: string, appId: string): Promise<{ price: number | null; diag: Diag }> {
  const endpoint = 'https://svcs.ebay.com/services/search/FindingService/v1'
  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.13.0',
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': 'true',
    'GLOBAL-ID': 'EBAY-US',
    'SECURITY-APPNAME': appId,
    'keywords': keywords,
    'paginationInput.entriesPerPage': '50',
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value': 'true'
  })

  const headers: Record<string,string> = {
    'Accept': 'application/json',
    'User-Agent': 'CardTrack/1.0 (+netlify)',
    'X-EBAY-SOA-OPERATION-NAME': 'findCompletedItems',
    'X-EBAY-SOA-SERVICE-VERSION': '1.13.0',
    'X-EBAY-SOA-GLOBAL-ID': 'EBAY-US',
    'X-EBAY-SOA-SECURITY-APPNAME': appId,
    'X-EBAY-SOA-REQUEST-DATA-FORMAT': 'JSON',
    'X-EBAY-SOA-RESPONSE-DATA-FORMAT': 'JSON'
  }

  const res = await fetch(`${endpoint}?${params.toString()}`, { method: 'GET', headers })
  const status = res.status
  if (!res.ok) {
    let hint = ''
    try { hint = (await res.text()).slice(0, 240) } catch {}
    const limited = hint.includes('"errorId":["10001"') || hint.lower().find ? false : hint.includes('RateLimiter') // best-effort detect
    return { price: null, diag: { status, ack: 'HTTP ' + status, count: 0, limited, bodyHint: hint } }
  }
  let data: any
  try { data = await res.json() } catch (e: any) {
    return { price: null, diag: { status, ack: 'Bad JSON', count: 0, bodyHint: (e?.message || 'parse error').slice(0,140) } }
  }
  const ack = data?.findCompletedItemsResponse?.[0]?.ack?.[0] ?? 'Unknown'
  if (ack !== 'Success') return { price: null, diag: { status, ack, count: 0 } }
  const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || []
  const prices: number[] = []
  for (const it of items) {
    const priceStr = it?.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ ?? it?.sellingStatus?.[0]?.convertedCurrentPrice?.[0]?.__value__
    const p = priceStr != null ? Number(priceStr) : NaN
    if (Number.isFinite(p)) prices.push(p)
  }
  return { price: prices.length ? median(prices) : null, diag: { status, ack, count: prices.length } }
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

const sleep = (ms:number)=> new Promise(r=>setTimeout(r, ms))

async function quoteFor(i: ItemIn): Promise<{ q: Quote; limited: boolean }> {
  const sig = sigOf(i)
  const cached = MEM.map!.get(sig)
  const now = Date.now()
  if (cached && cached.exp > now) {
    return { q: { id: i.id, price: cached.price, at: cached.at, source: cached.source, count: cached.count }, limited: false }
  }

  let source: 'ebay-sold' | 'mock' = 'mock'
  let count = 0
  let price: number | null = null
  let limited = false

  const appId = process.env.EBAY_APP_ID
  if (appId) {
    const kw = bestKeywords(i)
    if (kw) {
      const r = await ebayFindCompleted(kw, appId)
      if (r.diag.limited) limited = true
      if (r.price != null && r.diag.count > 0) {
        price = r.price
        count = r.diag.count
        source = 'ebay-sold'
      }
    }
  }

  if (price == null) price = mockFromSig(sig)

  const at = nowISO()
  MEM.map!.set(sig, { price, at, exp: now + TEN_MIN, source, count })
  return { q: { id: i.id, price, at, source, count }, limited }
}

export const handler: Handler = async (event) => {
  if (event.httpMethod === 'GET') {
    const { name = '', set = '', number = '', condition = '' } = event.queryStringParameters || {}
    if (!String(name).trim()) return bad(400, 'name is required')
    const out = await quoteFor({ name: String(name), set: String(set), number: String(number), condition: String(condition) })
    return ok({ ok: true, quote: out.q, limited: out.limited })
  }

  if (event.httpMethod === 'POST') {
    try {
      const body = event.body ? JSON.parse(event.body) : {}
      const items = Array.isArray(body?.items) ? body.items as ItemIn[] : []
      if (!items.length) return bad(400, 'items required')

      // Dedupe by signature
      const uniqMap = new Map<string, ItemIn[]>()
      for (const it of items) {
        const key = sigOf(it)
        const arr = uniqMap.get(key) || []
        arr.push(it); uniqMap.set(key, arr)
      }

      const quotes: Quote[] = []
      let limitedAny = false

      for (const [key, group] of uniqMap.entries()) {
        // Use the first representative to fetch
        const primary = group[0]
        const { q, limited } = await quoteFor(primary)
        limitedAny = limitedAny || limited
        // assign price to all items in the group
        for (const it of group) {
          quotes.push({ id: it.id, price: q.price, at: q.at, source: q.source, count: q.count })
        }
        // polite delay between eBay calls
        await sleep(DEFAULT_DELAY_MS)
      }

      return ok({ ok: true, quotes, limited: limitedAny })
    } catch {
      return ok({ ok: true, quotes: [] })
    }
  }

  return bad(405, 'Method not allowed')
}

export default handler
