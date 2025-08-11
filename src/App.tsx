import { useState, useEffect, useMemo, useRef, useCallback } from 'react'

type Page = 'home' | 'collections' | 'market'

export default function App() {
  const [page, setPage] = useState<Page>('home')

  useEffect(() => {
    const saved = window.location.hash.replace('#', '')
    if (saved === 'collections' || saved === 'market') setPage(saved as Page)
  }, [])

  useEffect(() => {
    window.location.hash = page
  }, [page])

  return (
    <div>
      <Navbar page={page} onNavigate={setPage} />
      <main className="container-responsive py-10 space-y-10">
        {page === 'home' && <Home onGetStarted={() => setPage('collections')} />}
        {page === 'collections' && <Collections />}
        {page === 'market' && <Market />}
      </main>
      <Footer />
    </div>
  )
}

function Navbar({ page, onNavigate }:{ page: Page; onNavigate: (p: Page) => void }){
  const link = (key: Page, label: string) => (
    <button
      onClick={()=>onNavigate(key)}
      className={`nav-link ${page===key ? 'active-link' : ''}`}
      aria-current={page===key ? 'page' : undefined}
    >
      {label}
    </button>
  )
  return (
    <header className="border-b bg-white">
      <div className="container-responsive py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-slate-900 grid place-items-center text-white font-bold">CT</div>
          <span className="font-semibold text-lg">CardTrack</span>
        </div>
        <nav className="flex items-center gap-6">
          {link('home','Home')}
          {link('collections','My Collection')}
          {link('market','Market (soon)')}
          <a className="btn-primary rounded-xl px-3 py-2" href="/.netlify/functions/hello">
            Ping Function
          </a>
        </nav>
      </div>
    </header>
  )
}

function SectionCard({ title, children }:{title:string; children: React.ReactNode}){
  return (
    <section className="card p-6">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <div className="text-slate-600">{children}</div>
    </section>
  )
}

function Home({ onGetStarted }:{ onGetStarted: ()=>void }){
  return (
    <div className="space-y-8">
      <div className="grid md:grid-cols-2 gap-8 items-center">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight">
            Track your <span className="text-slate-700">Sports Cards</span> & TCG like a pro
          </h1>
          <p className="text-slate-600">
            Clean UI. Interactive tools. Built to grow into real-time pricing, inventory, and more.
          </p>
          <div className="flex gap-3">
            <button className="btn-primary" onClick={onGetStarted}>Get started</button>
            <a className="btn border border-slate-200" href="https://docs.netlify.com/" target="_blank" rel="noreferrer">Netlify Docs</a>
          </div>
        </div>
        <div className="card p-4">
          <DemoWidget />
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-6">
        <SectionCard title="Collections">
          Add cards with set, number, and condition. Local-first; cloud sync later.
        </SectionCard>
        <SectionCard title="Insights">
          See totals, estimated value, and trends as we hook up pricing APIs.
        </SectionCard>
        <SectionCard title="Market">
          eBay + SportsCardsPro integration planned. You’re set up to expand.
        </SectionCard>
      </div>
    </div>
  )
}

function DemoWidget(){
  const [qty, setQty] = useState(12)
  const [value, setValue] = useState(3.5)
  const est = (qty*value).toFixed(2)
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Mini Value Estimator</h3>
      <div className="grid sm:grid-cols-3 gap-4">
        <label className="block">
          <div className="text-sm text-slate-500">Quantity</div>
          <input type="number" className="w-full border rounded-xl px-3 py-2" value={qty}
            onChange={e=>setQty(parseInt(e.target.value||'0'))} min={0} />
        </label>
        <label className="block">
          <div className="text-sm text-slate-500">Avg Price ($)</div>
          <input type="number" className="w-full border rounded-xl px-3 py-2" value={value}
            onChange={e=>setValue(parseFloat(e.target.value||'0'))} step="0.01" min={0}/>
        </label>
        <div className="grid place-items-center">
          <div className="text-sm text-slate-500">Est. Value</div>
          <div className="text-2xl font-bold">${est}</div>
        </div>
      </div>
    </div>
  )
}

/* =====================
   Collections + Pricing + UX wins
   ===================== */

type Condition = 'Raw' | 'PSA 10' | 'PSA 9' | 'BGS 9.5' | 'Other'
type CardItem = { id: string; name: string; set: string; number: string; condition: Condition; qty: number }

type SortKey = 'name' | 'set' | 'number' | 'condition' | 'qty'
type SortDir = 'asc' | 'desc'
type BusyKind = 'idle' | 'import-csv' | 'restore-json' | 'pricing'

/* Toasts with micro-animations */
type ToastKind = 'success' | 'info' | 'error'
type Toast = { id: string; kind: ToastKind; title: string; msg?: string; closing?: boolean }

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const hardRemove = useCallback((id: string) => { setToasts(prev => prev.filter(t => t.id !== id)) }, [])
  const startDismiss = useCallback((id: string) => {
    setToasts(prev => prev.map(t => t.id === id ? { ...t, closing: true } : t))
    setTimeout(() => hardRemove(id), 220)
  }, [hardRemove])
  const push = useCallback((kind: ToastKind, title: string, msg?: string) => {
    const id = crypto.randomUUID()
    const t: Toast = { id, kind, title, msg, closing: false }
    setToasts(prev => [...prev, t])
    setTimeout(() => startDismiss(id), 3500)
  }, [startDismiss])
  return { toasts,
    success:(t:string,m?:string)=>push('success',t,m),
    info:(t:string,m?:string)=>push('info',t,m),
    error:(t:string,m?:string)=>push('error',t,m),
    dismiss:startDismiss }
}

/* Price cache (localStorage) */
type PriceData = { price: number; at: string } // at = ISO timestamp
const PRICE_TTL_MS = 10 * 60 * 1000
const PRICE_CACHE_KEY = 'ct_price_cache'

function sigOf(name: string, set: string, number: string, condition?: string){
  return [name, set, number, condition||'Raw'].map(s=>String(s||'').trim().toLowerCase()).join('|')
}
function sigOfItem(i: Pick<CardItem,'name'|'set'|'number'|'condition'>){ return sigOf(i.name, i.set, i.number, i.condition) }

function loadPriceCache(): Record<string, PriceData> {
  try { return JSON.parse(localStorage.getItem(PRICE_CACHE_KEY) || '{}') } catch { return {} }
}
function savePriceCache(data: Record<string, PriceData>){ localStorage.setItem(PRICE_CACHE_KEY, JSON.stringify(data)) }
function priceCacheGet(sig: string): PriceData | null {
  const data = loadPriceCache()[sig]
  if (!data) return null
  const age = Date.now() - new Date(data.at).getTime()
  if (Number.isNaN(age)) return null
  return { price: data.price, at: data.at }
}
function priceCacheSet(sig: string, p: PriceData){
  const all = loadPriceCache()
  all[sig] = p
  savePriceCache(all)
}
function isStale(iso: string){ return (Date.now() - new Date(iso).getTime()) > PRICE_TTL_MS }
function ageLabel(iso: string){
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 10_000) return 'Just now'
  const mins = Math.floor(diff/60000); if (mins < 60) return mins + 'm ago'
  const hrs = Math.floor(mins/60); if (hrs < 48) return hrs + 'h ago'
  const days = Math.floor(hrs/24); return days + 'd ago'
}

function ToastViewport({ toasts, dismiss }:{ toasts: Toast[]; dismiss: (id: string)=>void }) {
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-3 w-80">
      {toasts.map(t => <ToastCard key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />)}
    </div>
  )
}
function ToastCard({ toast, onDismiss }:{ toast: Toast; onDismiss: ()=>void }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(()=>setMounted(true)); return ()=>cancelAnimationFrame(id) }, [])
  const bg = toast.kind === 'success' ? 'bg-emerald-600' : toast.kind === 'error' ? 'bg-rose-600' : 'bg-slate-800'
  const Icon = toast.kind === 'success' ? IconCheck : toast.kind === 'error' ? IconX : IconInfo
  const entering = mounted && !toast.closing
  const base = 'text-white rounded-xl shadow-soft p-3 transition-all duration-200 ease-out'
  const motion = entering ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-[0.98]'
  return (
    <div className={`${base} ${bg} ${motion}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5"><Icon /></div>
        <div className="flex-1">
          <div className="font-semibold">{toast.title}</div>
          {toast.msg && <div className="text-white/90 text-sm">{toast.msg}</div>}
        </div>
        <button className="opacity-80 hover:opacity-100" onClick={onDismiss} aria-label="Dismiss"><IconX /></button>
      </div>
    </div>
  )
}

/* CSV helpers */
const csvEscape = (s: string) => `"${s.replace(/"/g, '""')}"`
function toCSV(rows: CardItem[]) {
  const header = ['name','set','number','condition','qty'].join(',')
  const body = rows.map((r: CardItem)=>[
    csvEscape(r.name), csvEscape(r.set), csvEscape(r.number), csvEscape(r.condition), String(r.qty)
  ].join(',')).join('\n')
  return `${header}\n${body}`
}
function parseCSV(text: string): Omit<CardItem,'id'>[] {
  const lines = text.split(/\r?\n/).filter(Boolean)
  if (!lines.length) return []
  const header = lines[0].split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/).map(h=>h.trim().toLowerCase())
  const idx = (k:string)=> header.indexOf(k)
  const need = ['name','set','number','condition','qty']
  if (!need.every(k=>idx(k)>=0)) return []
  const rows: Omit<CardItem,'id'>[] = []
  for (let i=1;i<lines.length;i++){
    const cols = lines[i].match(/("([^"]|"")*"|[^,]*)/g)?.filter((c)=>c!==',') ?? []
    const unq = (s:string)=> s?.startsWith('"') ? s.slice(1, -1).replace(/""/g,'"') : s
    const name = unq(cols[idx('name')] || '').trim()
    if (!name) continue
    const set = unq(cols[idx('set')] || '').trim()
    const number = unq(cols[idx('number')] || '').trim()
    const condition = (unq(cols[idx('condition')] || 'Raw').trim() as Condition) || 'Raw'
    const qty = Math.max(0, parseInt(unq(cols[idx('qty')] || '1').trim() || '1')) || 1
    rows.push({ name, set, number, condition, qty })
  }
  return rows
}

function Collections(){
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const [items, setItems] = useState<CardItem[]>(()=>{
    const raw = localStorage.getItem('ct_items')
    return raw ? JSON.parse(raw) as CardItem[] : []
  })
  const [draft, setDraft] = useState<Omit<CardItem,'id'>>({
    name: '', set: '', number: '', condition: 'Raw', qty: 1
  })

  // Filters + sorting
  const [search, setSearch] = useState('')
  const [condFilter, setCondFilter] = useState<Condition | 'All'>('All')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  // Quick edit modal
  const [editing, setEditing] = useState<CardItem | null>(null)
  const [editDraft, setEditDraft] = useState<Omit<CardItem,'id'>>({ name:'', set:'', number:'', condition:'Raw', qty:1 })

  // File inputs + busy state
  const [busy, setBusy] = useState<BusyKind>('idle')
  const csvInputRef = useRef<HTMLInputElement | null>(null)
  const jsonInputRef = useRef<HTMLInputElement | null>(null)

  // Row-level loading
  const [rowLoading, setRowLoading] = useState<Record<string, boolean>>({})

  // Pricing map: item.id -> PriceData
  const [prices, setPrices] = useState<Record<string, PriceData>>({})

  // Toasts
  const toasts = useToasts()

  useEffect(()=>{ localStorage.setItem('ct_items', JSON.stringify(items)) }, [items])

  // On items change, hydrate prices from cache (for new items only, keep existing row prices)
  useEffect(() => {
    setPrices(prev => {
      const next = { ...prev }
      for (const it of items) {
        if (next[it.id]) continue
        const cached = priceCacheGet(sigOfItem(it))
        if (cached) next[it.id] = cached
      }
      return next
    })
  }, [items])

  // Derived list
  const visible = useMemo<CardItem[]>(() => {
    const q = search.trim().toLowerCase()
    const filtered = items.filter((i: CardItem) => {
      const matchesQ = !q || [i.name, i.set, i.number, i.condition].some(v=>String(v).toLowerCase().includes(q))
      const matchesC = condFilter === 'All' || i.condition === condFilter
      return matchesQ && matchesC
    })
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a: CardItem, b: CardItem) => {
      const ak = a[sortKey], bk = b[sortKey]
      if (sortKey === 'qty') return ((ak as number) - (bk as number)) * dir
      return collator.compare(String(ak), String(bk)) * dir
    })
  }, [items, search, condFilter, sortKey, sortDir])

  const add = () => {
    if (!draft.name.trim()) { nameInputRef.current?.focus(); return }
    setItems(prev => [...prev, { ...draft, id: crypto.randomUUID() }])
    setDraft({ name:'', set:'', number:'', condition:'Raw', qty:1 })
    toasts.success('Card added', 'Your card was added to the collection.')
  }
  const remove = (id:string) => {
    setItems(prev => prev.filter(i=>i.id!==id))
    setPrices(prev => { const { [id]: _, ...rest } = prev; return rest })
    toasts.info('Card removed')
  }

  const onHeaderClick = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const openEdit = (item: CardItem) => {
    setEditing(item)
    setEditDraft({ name:item.name, set:item.set, number:item.number, condition:item.condition, qty:item.qty })
  }
  const saveEdit = () => {
    if (!editing) return
    const updated: CardItem = { ...editing, ...editDraft }
    setItems(prev => prev.map(i => i.id === editing.id ? updated : i))
    // Refresh price from cache for the new signature (or clear if none)
    const sig = sigOfItem(updated)
    const cached = priceCacheGet(sig)
    setPrices(prev => {
      const next = { ...prev }
      if (cached) next[updated.id] = cached
      else delete next[updated.id]
      return next
    })
    setEditing(null)
    toasts.success('Changes saved')
  }

  // Exporters
  const download = (filename: string, blob: Blob) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }
  const exportCSV = () => {
    download('collection.csv', new Blob([toCSV(items)], { type: 'text/csv;charset=utf-8;' }))
    toasts.info('CSV exported')
  }
  const backupJSON = () => {
    download('collection-backup.json', new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' }))
    toasts.info('Backup saved')
  }

  // Importers with CSV dedupe
  const handleCSVChosen = async (file: File | null) => {
    if (!file) return
    setBusy('import-csv')
    try {
      const text = await file.text()
      const rows = parseCSV(text)
      if (!rows.length) { toasts.error('Import failed', 'No valid rows. Headers: name,set,number,condition,qty'); return }

      setItems(prev => {
        const list = [...prev]
        const existingIndex = new Map<string, number>()
        prev.forEach((it, idx) => existingIndex.set(sigOfItem(it), idx))

        const newIndex = new Map<string, number>()
        let merged = 0, created = 0

        for (const r of rows) {
          const sig = sigOfItem({ ...r, id: '', qty: 0 } as CardItem)
          const eIdx = existingIndex.get(sig)
          if (eIdx != null) {
            list[eIdx] = { ...list[eIdx], qty: list[eIdx].qty + r.qty }
            merged++
            continue
          }
          const nIdx = newIndex.get(sig)
          if (nIdx != null) {
            list[nIdx] = { ...list[nIdx], qty: list[nIdx].qty + r.qty }
            merged++
            continue
          }
          const item: CardItem = { id: crypto.randomUUID(), ...r }
          list.push(item)
          newIndex.set(sig, list.length - 1)
          created++
        }

        toasts.success('Import complete', `${created} new, ${merged} merged`)
        return list
      })
    } catch {
      toasts.error('Import failed')
    } finally {
      if (csvInputRef.current) csvInputRef.current.value = ''
      setBusy('idle')
    }
  }

  const restoreJSON = async (file: File | null) => {
    if (!file) return
    setBusy('restore-json')
    try {
      const json = JSON.parse(await file.text()) as CardItem[]
      if (!Array.isArray(json)) throw new Error()
      if (!confirm('Replace your current collection with this backup?')) return
      const clean: CardItem[] = json.map((it: Partial<CardItem>) => ({
        id: it.id || crypto.randomUUID(),
        name: String(it.name || '').trim(),
        set: String(it.set || '').trim(),
        number: String(it.number || '').trim(),
        condition: (['Raw','PSA 10','PSA 9','BGS 9.5','Other'].includes(String(it.condition)) ? it.condition : 'Raw') as Condition,
        qty: Math.max(0, Number(it.qty) || 0)
      })).filter((i: CardItem) => i.name)
      setItems(clean)
      setPrices({}) // reset pricing when restoring
      toasts.success('Restore complete', `${clean.length} cards loaded`)
    } catch {
      toasts.error('Restore failed', 'Invalid JSON backup file')
    } finally {
      if (jsonInputRef.current) jsonInputRef.current.value = ''
      setBusy('idle')
    }
  }

  // Pricing
  type PriceResp = { ok: boolean; quotes?: { id?: string; price: number; at: string }[]; quote?: { price: number; at: string } }
  const setRowBusy = (id: string, busy: boolean) => setRowLoading(prev => ({ ...prev, [id]: busy }))

  const updatePriceFor = (id: string, item: CardItem, price: number, at: string) => {
    const sig = sigOfItem(item)
    priceCacheSet(sig, { price, at })
    setPrices(prev => ({ ...prev, [id]: { price, at } }))
  }

  const refreshPrices = async () => {
    if (items.length === 0) { toasts.info('Nothing to price'); return }
    setBusy('pricing')
    try {
      const payload = {
        items: items.map(i => ({ id: i.id, name: i.name, set: i.set, number: i.number, condition: i.condition }))
      }
      const res = await fetch('/.netlify/functions/prices', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload)
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as PriceResp
      if (!data.ok || !Array.isArray(data.quotes)) throw new Error('Malformed response')

      const now = new Date().toISOString()
      for (const it of items) {
        const q = data.quotes.find(q => q.id === it.id)
        if (!q) continue
        updatePriceFor(it.id, it, q.price, q.at || now)
      }
      toasts.success('Prices updated', `Fetched ${data.quotes.length} quotes`)
    } catch (e) {
      toasts.error('Pricing failed', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setBusy('idle')
    }
  }

  const refreshOne = async (it: CardItem) => {
    setRowBusy(it.id, true)
    try {
      const qs = new URLSearchParams({ name: it.name, set: it.set, number: it.number, condition: it.condition })
      const res = await fetch('/.netlify/functions/prices?' + qs.toString())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as PriceResp
      if (!data.ok || !data.quote) throw new Error('Malformed response')
      const at = data.quote.at || new Date().toISOString()
      updatePriceFor(it.id, it, data.quote.price, at)
      toasts.success('Price updated')
    } catch (e) {
      toasts.error('Row pricing failed', e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setRowBusy(it.id, false)
    }
  }

  const totalQty = items.reduce((a,b)=>a+b.qty,0)
  const totalEst = items.reduce((sum, i)=> sum + (prices[i.id]?.price || 0) * i.qty, 0)

  const Th = ({ k, label }:{ k: SortKey; label: string }) => (
    <th className="px-4 py-2 cursor-pointer select-none" onClick={()=>onHeaderClick(k)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey===k && <span aria-hidden>{sortDir==='asc'?'▲':'▼'}</span>}
      </span>
    </th>
  )

  const showEmpty = items.length === 0 && search.trim() === '' && condFilter === 'All'

  return (
    <div className="space-y-6 relative">
      <h1 className="text-3xl font-bold">My Collection</h1>

      {/* Add row */}
      <div className="card p-4 space-y-4">
        <div className="grid md:grid-cols-5 gap-3">
          <input ref={nameInputRef} className="border rounded-xl px-3 py-2" placeholder="Card name" value={draft.name}
            onChange={e=>setDraft({...draft, name:e.target.value})}/>
          <input className="border rounded-xl px-3 py-2" placeholder="Set" value={draft.set}
            onChange={e=>setDraft({...draft, set:e.target.value})}/>
          <input className="border rounded-xl px-3 py-2" placeholder="Card #" value={draft.number}
            onChange={e=>setDraft({...draft, number:e.target.value})}/>
          <select className="border rounded-xl px-3 py-2" value={draft.condition}
            onChange={e=>setDraft({...draft, condition:e.target.value as Condition})}>
            <option>Raw</option><option>PSA 10</option><option>PSA 9</option><option>BGS 9.5</option><option>Other</option>
          </select>
          <div className="flex gap-2">
            <input type="number" min="1" className="border rounded-xl px-3 py-2 w-24" value={draft.qty}
              onChange={e=>setDraft({...draft, qty: Math.max(1, parseInt(e.target.value||'1'))})}/>
            <button className="btn-primary" onClick={add}>Add</button>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="relative">
            <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"><IconSearch className="opacity-50" /></div>
            <input
              className="border rounded-xl pl-10 pr-3 py-2 w-64"
              placeholder="Search name, set, #, condition"
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
            />
          </div>
          <select className="border rounded-xl px-3 py-2"
                  value={condFilter}
                  onChange={e=>setCondFilter(e.target.value as Condition|'All')}>
            <option value="All">All Conditions</option>
            <option>Raw</option><option>PSA 10</option><option>PSA 9</option><option>BGS 9.5</option><option>Other</option>
          </select>
        </div>

        <div className="flex flex-wrap gap-2">
          <button className="btn border" onClick={exportCSV}><span className="inline-flex items-center gap-2"><IconDownload /> Export CSV</span></button>
          <button className="btn border" onClick={()=>csvInputRef.current?.click()}><span className="inline-flex items-center gap-2"><IconUpload /> Import CSV</span></button>
          <input ref={csvInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e=>handleCSVChosen(e.target.files?.[0] || null)} />
          <button className="btn border" onClick={backupJSON}><span className="inline-flex items-center gap-2"><IconDownload /> Backup JSON</span></button>
          <button className="btn border" onClick={()=>jsonInputRef.current?.click()}><span className="inline-flex items-center gap-2"><IconUpload /> Restore JSON</span></button>
          <input ref={jsonInputRef} type="file" accept="application/json,.json" className="hidden" onChange={e=>restoreJSON(e.target.files?.[0] || null)} />
          <button className="btn border" onClick={refreshPrices}><span className="inline-flex items-center gap-2"><IconRefresh /> Refresh Prices</span></button>
        </div>
      </div>

      {/* Empty state */}
      {showEmpty ? (
        <div className="card p-10 grid place-items-center text-center text-slate-600">
          <div className="mb-4 text-slate-400"><IconBox className="w-12 h-12" /></div>
          <h3 className="text-xl font-semibold mb-1">No cards yet</h3>
          <p className="mb-4">Start by adding your first card. You can import a CSV later.</p>
          <button className="btn-primary" onClick={()=>nameInputRef.current?.focus()}><span className="inline-flex items-center gap-2"><IconPlus /> Add a card</span></button>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden relative">
          {/* Busy overlay for bulk actions */}
          {busy !== 'idle' && (
            <div className="absolute inset-0 bg-white/70 backdrop-blur-sm grid place-items-center z-10">
              <div className="text-center">
                <div className="mx-auto mb-3 h-10 w-10 rounded-full border-2 border-slate-300 border-t-slate-600 animate-spin" />
                <div className="text-slate-700 font-medium">
                  {busy==='import-csv' ? 'Importing CSV…' : busy==='restore-json' ? 'Restoring backup…' : 'Fetching prices…'}
                </div>
                <div className="text-slate-500 text-sm mt-1">This should only take a moment.</div>
              </div>
            </div>
          )}

          <table className="w-full text-left">
            <thead className="bg-slate-100">
              <tr>
                <Th k="name" label="Name" />
                <Th k="set" label="Set" />
                <Th k="number" label="#" />
                <Th k="condition" label="Condition" />
                <th className="px-4 py-2">Price</th>
                <Th k="qty" label="Qty" />
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((i: CardItem) => {
                const p = prices[i.id]
                const isBusy = !!rowLoading[i.id] || (busy==='pricing' && !p)
                const stale = p ? isStale(p.at) : false
                return (
                  <tr key={i.id} className="border-t hover:bg-slate-50">
                    <td className="px-4 py-2">{i.name}</td>
                    <td className="px-4 py-2">{i.set}</td>
                    <td className="px-4 py-2">{i.number}</td>
                    <td className="px-4 py-2">{i.condition}</td>
                    <td className="px-4 py-2">
                      {isBusy ? (
                        <span className="inline-block h-6 w-28 rounded bg-slate-200 animate-pulse align-middle" />
                      ) : p ? (
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-sm border ${stale ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                            ${p.price.toFixed(2)} <span className="opacity-70">USD</span>
                          </span>
                          <span className={`text-xs ${stale ? 'text-amber-600' : 'text-slate-500'}`} title={new Date(p.at).toLocaleString()}>
                            {ageLabel(p.at)}{stale ? ' • stale' : ''}
                          </span>
                          <button className="btn border px-2 py-1 text-xs" onClick={()=>refreshOne(i)} title="Refresh this row">
                            <span className="inline-flex items-center gap-1"><IconRefresh /> Refresh</span>
                          </button>
                        </div>
                      ) : (
                        <button className="btn border px-2 py-1 text-xs" onClick={()=>refreshOne(i)} title="Get price">
                          <span className="inline-flex items-center gap-1"><IconRefresh /> Get price</span>
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-2">{i.qty}</td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <button className="btn border" onClick={()=>openEdit(i)}>Edit</button>
                      <button className="btn border" onClick={()=>remove(i.id)}>Remove</button>
                    </td>
                  </tr>
                )
              })}
              {visible.length === 0 && (
                <tr><td className="px-4 py-6 text-slate-500" colSpan={7}>No results. Try adjusting filters.</td></tr>
              )}
            </tbody>
            {items.length>0 && (
              <tfoot>
                <tr className="border-t bg-slate-50">
                  <td className="px-4 py-2 font-semibold" colSpan={4}>Totals</td>
                  <td className="px-4 py-2 font-semibold">
                    Est. Value: ${totalEst.toFixed(2)}
                  </td>
                  <td className="px-4 py-2 font-semibold">{totalQty}</td>
                  <td></td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}

      {/* Quick Edit Modal */}
      {editing && (
        <Modal title="Edit Card" onClose={()=>setEditing(null)} actions={
          <>
            <button className="btn border" onClick={()=>setEditing(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveEdit}>Save</button>
          </>
        }>
          <div className="grid md:grid-cols-5 gap-3">
            <input className="border rounded-xl px-3 py-2" placeholder="Card name" value={editDraft.name}
              onChange={e=>setEditDraft({...editDraft, name:e.target.value})}/>
            <input className="border rounded-xl px-3 py-2" placeholder="Set" value={editDraft.set}
              onChange={e=>setEditDraft({...editDraft, set:e.target.value})}/>
            <input className="border rounded-xl px-3 py-2" placeholder="Card #" value={editDraft.number}
              onChange={e=>setEditDraft({...editDraft, number:e.target.value})}/>
            <select className="border rounded-xl px-3 py-2" value={editDraft.condition}
              onChange={e=>setEditDraft({...editDraft, condition:e.target.value as Condition})}>
              <option>Raw</option><option>PSA 10</option><option>PSA 9</option><option>BGS 9.5</option><option>Other</option>
            </select>
            <input type="number" min="0" className="border rounded-xl px-3 py-2 w-24" value={editDraft.qty}
              onChange={e=>setEditDraft({...editDraft, qty: Math.max(0, parseInt(e.target.value||'0'))})}/>
          </div>
        </Modal>
      )}

      {/* Toasts */}
      <ToastViewport toasts={toasts.toasts} dismiss={toasts.dismiss} />
    </div>
  )
}

function Market(){
  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Market</h1>
      <div className="card p-6">
        <p className="text-slate-600">
          Coming soon: live pricing from sources like eBay and SportsCardsPro. The header button
          "Ping Function" calls an example Netlify serverless function to prove functions are wired.
        </p>
        <ul className="list-disc pl-6 text-slate-600 mt-2">
          <li>When ready, we’ll add API keys via Netlify environment variables.</li>
          <li>We’ll create webhook endpoints under <code>/.netlify/functions/*</code>.</li>
        </ul>
      </div>
    </div>
  )
}

function Footer(){
  return (
    <footer className="border-t mt-10">
      <div className="container-responsive py-6 text-sm text-slate-500">
        © {new Date().getFullYear()} CardTrack — Built for Netlify. Starter is local-first and expandable.
      </div>
    </footer>
  )
}

/** Minimal Modal */
function Modal({ title, children, actions, onClose }:{
  title: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  onClose: ()=>void;
}){
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div role="dialog" aria-modal="true" className="card p-6 w-full max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold">{title}</h3>
            <button className="btn border" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="space-y-4">{children}</div>
          <div className="mt-6 flex justify-end gap-2">{actions}</div>
        </div>
      </div>
    </div>
  )
}

/* =====================
   Inline Icons (SVG)
   ===================== */
function IconCheck(){ return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)}
function IconX(){ return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)}
function IconInfo(){ return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 8h.01M11 12h1v5h1" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
  </svg>
)}
function IconUpload({ className }:{className?:string}){ return (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 16V7m0 0l-3 3m3-3l3 3M5 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)}
function IconDownload({ className }:{className?:string}){ return (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 8v9m0 0l3-3m-3 3l-3-3M5 20h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)}
function IconBox({ className }:{className?:string}){ return (
  <svg className={className} viewBox="0 0 24 24" aria-hidden>
    <path d="M3 7l9 4 9-4M3 7l9-4 9 4M3 7v10l9 4 9-4V7" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)}
function IconPlus({ className }:{className?:string}){ return (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)}
function IconSearch({ className }:{className?:string}){ return (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)}
function IconRefresh(){ return (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path d="M20 12a8 8 0 10-2.34 5.66M20 12v-6m0 6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)}
