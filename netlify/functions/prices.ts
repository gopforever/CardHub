// No import from '@netlify/functions' so we don't need that package installed.
// Netlify detects the named export `handler` in TS and bundles it automatically.

type CacheVal = { price: number; at: string; exp: number; source: 'ebay-mi' | 'mock'; count?: number }
const MEM: { map?: Map<string, CacheVal>, token?: { access_token: string, exp: number } } = (globalThis as any).__ct_price_mem || {}
if (!MEM.map) MEM.map = new Map<string, CacheVal>()
;(globalThis as any).__ct_price_mem = MEM

const TEN_MIN = 10 * 60 * 1000
const DEFAULT_DELAY_MS = Number(process.env.EBAY_DELAY_MS || 800)

type ItemIn = { id?: string; name: string; set?: string; number?: string; condition?: string }
type Quote = { id?: string; price: number; at: string; source: 'ebay-mi' | 'mock'; count?: number }

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

function nowISO(){ return new Date().toISOString() }
const sleep = (ms:number)=> new Promise(r=>setTimeout(r, ms))

/** ---------- OAuth: Client Credentials ---------- */
async function getAppToken(): Promise<{ token?: string, error?: string }> {
  const clientId = process.env.EBAY_CLIENT_ID
  const clientSecret = process.env.EBAY_CLIENT_SECRET
  if (!clientId || !clientSecret) return { error: 'missing-ebay-credentials' }

  const env = (process.env.EBAY_ENV || 'production').toLowerCase()
  const base = env === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'
  const scope = process.env.EBAY_MI_SCOPE
    || 'https://api.ebay.com/oauth/api_scope https://api.ebay.com/oauth/api_scope/buy.marketplace.insights'

  // Reuse cached token if valid
  const now = Date.now()
  if (MEM.token && MEM.token.exp > now + 15000) return { token: MEM.token.access_token }

  const body = new URLSearchParams({ grant_type: 'client_credentials', scope })
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
  const res = await fetch(`${base}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${basic}`
    },
    body
  })

  if (!res.ok) {
    const hint = await res.text().catch(()=> '')
    return { error: `oauth-${res.status}: ${hint.slice(0,240)}` }
  }
  const data: any = await res.json().catch(()=> ({}))
  if (!data?.access_token || !data?.expires_in) return { error: 'oauth-bad-json' }
  MEM.token = { access_token: data.access_token, exp: now + (Number(data.expires_in) * 1000) }
  return { token: data.access_token }
}

/** ---------- Marketplace Insights call ---------- */
type MIDiag = { status: number; count: number; limited?: boolean; bodyHint?: string }
async function miSearchSold(keywords: string): Promise<{ prices: number[], diag: MIDiag }> {
  const env = (process.env.EBAY_ENV || 'production').toLowerCase()
  const base = env === 'sandbox' ? 'https://api.sandbox.ebay.com' : 'https://api.ebay.com'
  const { token, error } = await getAppToken()
  if (!token) return { prices: [], diag: { status: 0, count: 0, bodyHint: error || 'no-token' } }

  const params = new URLSearchParams({
    q: keywords,
    limit: '50'
  })

  const res = await fetch(`${base}/buy/marketplace_insights/v1_beta/item_sales/search?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      'X-EBAY-C-MARKETPLACE-ID': 'EBAY_US'
    }
  })

  if (!res.ok) {
    let hint = ''
    try { hint = (await res.text()).slice(0, 240) } catch {}
    const lower = hint.toLowerCase()
    const limited = lower.includes('limit') || lower.includes('rate') || lower.includes('quota') || res.status === 429
    return { prices: [], diag: { status: res.status, count: 0, limited, bodyHint: hint } }
  }

  let data: any = {}
  try { data = await res.json() } catch { return { prices: [], diag: { status: 200, count: 0, bodyHint: 'bad-json' } } }

  const items = (data?.itemSales || data?.salesHistory || [])
  const prices: number[] = []
  for (const it of items) {
    const p = Number(it?.lastSoldPrice?.value ?? it?.price?.value ?? NaN)
    if (Number.isFinite(p)) prices.push(p)
  }
  return { prices, diag: { status: 200, count: prices.length } }
}

/** ---------- helpers ---------- */
function bestKeywords(i: ItemIn): string {
  return [i.name, i.set, i.number].filter(Boolean).map(s => String(s).trim()).join(' ')
}

function mockFromSig(sig: string){
  let hash = 0
  for (let c of sig) hash = ((hash << 5) - hash + c.charCodeAt(0)) | 0
  const base = Math.abs(hash % 2000) / 10 + 1 // 1.0 .. 200.0
  return Math.round(base * 100) / 100
}

async function quoteFor(i: ItemIn, debug: boolean): Promise<{ q: Quote; meta?: any }> {
  const sig = sigOf(i)
  const cached = MEM.map!.get(sig)
  const now = Date.now()
  if (cached && cached.exp > now) {
    const q = { id: i.id, price: cached.price, at: cached.at, source: cached.source, count: cached.count }
    return { q, meta: debug ? { cached: true } : undefined }
  }

  let source: 'ebay-mi' | 'mock' = 'mock'
  let count = 0
  let price: number | null = null
  let meta: any = undefined

  const kw = bestKeywords(i)
  if (kw && process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET) {
    const mi = await miSearchSold(kw)
    meta = debug ? { mi } : undefined
    if (mi.prices.length) {
      price = median(mi.prices)
      count = mi.prices.length
      source = 'ebay-mi'
    }
  }

  if (price == null) price = mockFromSig(sig)

  const at = nowISO()
  MEM.map!.set(sig, { price, at, exp: now + TEN_MIN, source, count })
  const q = { id: i.id, price, at, source, count }
  return { q, meta }
}

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

export const handler = async (event: any) => {
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

      // Dedupe by signature
      const uniqMap = new Map<string, ItemIn[]>()
      for (const it of items) {
        const key = sigOf(it)
        const arr = uniqMap.get(key) || []
        arr.push(it); uniqMap.set(key, arr)
      }

      const out: Quote[] = []
      for (const [_, group] of uniqMap.entries()) {
        const primary = group[0]
        const { q } = await quoteFor(primary, debug)
        for (const it of group) {
          out.push({ id: it.id, price: q.price, at: q.at, source: q.source, count: q.count })
        }
        await sleep(DEFAULT_DELAY_MS)
      }
      return ok({ ok: true, quotes: out })
    } catch {
      return ok({ ok: true, quotes: [] })
    }
  }

  return bad(405, 'Method not allowed')
}
export default handler
