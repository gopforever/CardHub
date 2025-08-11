import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import type { SyntheticEvent } from 'react'

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
   Collections (lean version) + typed image onError
   ===================== */

type Condition = 'Raw' | 'PSA 10' | 'PSA 9' | 'BGS 9.5' | 'Other'
type CardItem = {
  id: string;
  name: string;
  set: string;
  number: string;
  condition: Condition;
  qty: number;
  image?: string;
}

type SortKey = 'name' | 'set' | 'number' | 'condition' | 'qty'
type SortDir = 'asc' | 'desc'

function Collections(){
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const [items, setItems] = useState<CardItem[]>(()=>{
    const raw = localStorage.getItem('ct_items')
    return raw ? JSON.parse(raw) as CardItem[] : []
  })
  const [draft, setDraft] = useState<Omit<CardItem,'id'>>({
    name: '', set: '', number: '', condition: 'Raw', qty: 1, image: ''
  })

  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  useEffect(()=>{ localStorage.setItem('ct_items', JSON.stringify(items)) }, [items])

  const visible = useMemo<CardItem[]>(() => {
    const q = search.trim().toLowerCase()
    const filtered = items.filter((i: CardItem) => {
      const matchesQ = !q || [i.name, i.set, i.number, i.condition].some(v=>String(v).toLowerCase().includes(q))
      return matchesQ
    })
    const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
    const dir = sortDir === 'asc' ? 1 : -1
    return [...filtered].sort((a: CardItem, b: CardItem) => {
      const ak = a[sortKey], bk = b[sortKey]
      if (sortKey === 'qty') return ((ak as number) - (bk as number)) * dir
      return collator.compare(String(ak), String(bk)) * dir
    })
  }, [items, search, sortKey, sortDir])

  const add = () => {
    if (!draft.name.trim()) { nameInputRef.current?.focus(); return }
    setItems(prev => [...prev, { ...draft, id: crypto.randomUUID() }])
    setDraft({ name:'', set:'', number:'', condition:'Raw', qty:1, image:'' })
  }
  const remove = (id:string) => { setItems(prev => prev.filter(i=>i.id!==id)) }

  const onHeaderClick = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  const Th = ({ k, label }:{ k: SortKey; label: string }) => (
    <th className="px-4 py-2 cursor-pointer select-none" onClick={()=>onHeaderClick(k)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey===k && <span aria-hidden>{sortDir==='asc'?'▲':'▼'}</span>}
      </span>
    </th>
  )

  const DEFAULT_PLACEHOLDER = (label: string) => {
    const text = encodeURIComponent(label.slice(0, 1).toUpperCase() || 'C')
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='80' height='80'><rect width='100%' height='100%' rx='10' ry='10' fill='#e2e8f0'/><text x='50%' y='54%' text-anchor='middle' font-size='34' font-family='system-ui, Segoe UI, sans-serif' fill='#475569'>${text}</text></svg>`
    return 'data:image/svg+xml;utf8,' + svg
  }

  return (
    <div className="space-y-6 relative">
      <h1 className="text-3xl font-bold">My Collection</h1>

      {/* Add row */}
      <div className="card p-4 space-y-4">
        <div className="grid md:grid-cols-6 gap-3">
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
          <input className="border rounded-xl px-3 py-2" placeholder="Image URL (optional)" value={draft.image || ''}
            onChange={e=>setDraft({...draft, image:e.target.value})}/>
          <div className="flex gap-2">
            <input type="number" min="1" className="border rounded-xl px-3 py-2 w-24" value={draft.qty}
              onChange={e=>setDraft({...draft, qty: Math.max(1, parseInt(e.target.value||'1'))})}/>
            <button className="btn-primary" onClick={add}>Add</button>
          </div>
        </div>
      </div>

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
        </div>
      </div>

      <div className="card p-0 overflow-hidden relative">
        <table className="w-full text-left">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-3 py-2">Img</th>
              <Th k="name" label="Name" />
              <Th k="set" label="Set" />
              <Th k="number" label="#" />
              <Th k="condition" label="Condition" />
              <Th k="qty" label="Qty" />
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((i: CardItem) => {
              const imgSrc = i.image && (i.image.startsWith('http://') || i.image.startsWith('https://')) ? i.image : DEFAULT_PLACEHOLDER(i.name)
              return (
                <tr key={i.id} className="border-t hover:bg-slate-50">
                  <td className="px-3 py-2">
                    <img
                      src={imgSrc}
                      alt={i.name}
                      className="h-12 w-12 object-cover rounded-lg border border-slate-200 bg-white"
                      onError={(e: SyntheticEvent<HTMLImageElement>) => {
                        e.currentTarget.src = DEFAULT_PLACEHOLDER(i.name)
                      }}
                    />
                  </td>
                  <td className="px-4 py-2">{i.name}</td>
                  <td className="px-4 py-2">{i.set}</td>
                  <td className="px-4 py-2">{i.number}</td>
                  <td className="px-4 py-2">{i.condition}</td>
                  <td className="px-4 py-2">{i.qty}</td>
                  <td className="px-4 py-2 text-right">
                    <button className="btn border" onClick={()=>setItems(prev => prev.filter(x=>x.id!==i.id))}>Remove</button>
                  </td>
                </tr>
              )
            })}
            {visible.length === 0 && (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={7}>No results. Add a card to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>
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

/* =====================
   Inline Icons (SVG)
   ===================== */
function IconSearch({ className }:{className?:string}){ return (
  <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
    <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2"/>
    <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
  </svg>
)}
