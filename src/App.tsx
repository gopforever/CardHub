import { useState, useEffect } from 'react'

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

type CardItem = {
  id: string;
  name: string;
  set: string;
  number: string;
  condition: 'Raw' | 'PSA 10' | 'PSA 9' | 'BGS 9.5' | 'Other';
  qty: number;
}

function Collections(){
  const [items, setItems] = useState<CardItem[]>(()=>{
    const raw = localStorage.getItem('ct_items')
    return raw ? JSON.parse(raw) as CardItem[] : []
  })
  const [draft, setDraft] = useState<Omit<CardItem,'id'>>({
    name: '', set: '', number: '', condition: 'Raw', qty: 1
  })

  useEffect(()=>{
    localStorage.setItem('ct_items', JSON.stringify(items))
  }, [items])

  const add = () => {
    if (!draft.name.trim()) return
    setItems(prev => [...prev, { ...draft, id: crypto.randomUUID() }])
    setDraft({ name:'', set:'', number:'', condition:'Raw', qty:1 })
  }

  const remove = (id:string) => setItems(prev => prev.filter(i=>i.id!==id))

  const totalQty = items.reduce((a,b)=>a+b.qty,0)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Collection</h1>
      <div className="card p-4 space-y-4">
        <div className="grid md:grid-cols-5 gap-3">
          <input className="border rounded-xl px-3 py-2" placeholder="Card name" value={draft.name}
            onChange={e=>setDraft({...draft, name:e.target.value})}/>
          <input className="border rounded-xl px-3 py-2" placeholder="Set" value={draft.set}
            onChange={e=>setDraft({...draft, set:e.target.value})}/>
          <input className="border rounded-xl px-3 py-2" placeholder="Card #" value={draft.number}
            onChange={e=>setDraft({...draft, number:e.target.value})}/>
          <select className="border rounded-xl px-3 py-2" value={draft.condition}
            onChange={e=>setDraft({...draft, condition:e.target.value as CardItem['condition']})}>
            <option>Raw</option><option>PSA 10</option><option>PSA 9</option><option>BGS 9.5</option><option>Other</option>
          </select>
          <div className="flex gap-2">
            <input type="number" min="1" className="border rounded-xl px-3 py-2 w-24" value={draft.qty}
              onChange={e=>setDraft({...draft, qty: parseInt(e.target.value||'1')})}/>
            <button className="btn-primary" onClick={add}>Add</button>
          </div>
        </div>
      </div>

      <div className="card p-0 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-100">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Set</th>
              <th className="px-4 py-2">#</th>
              <th className="px-4 py-2">Condition</th>
              <th className="px-4 py-2">Qty</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td className="px-4 py-6 text-slate-500" colSpan={6}>No cards yet — add a few above.</td></tr>
            ) : items.map(i => (
              <tr key={i.id} className="border-t">
                <td className="px-4 py-2">{i.name}</td>
                <td className="px-4 py-2">{i.set}</td>
                <td className="px-4 py-2">{i.number}</td>
                <td className="px-4 py-2">{i.condition}</td>
                <td className="px-4 py-2">{i.qty}</td>
                <td className="px-4 py-2 text-right">
                  <button className="btn border" onClick={()=>remove(i.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
          {items.length>0 && (
            <tfoot>
              <tr className="border-t bg-slate-50">
                <td className="px-4 py-2 font-semibold" colSpan={4}>Total</td>
                <td className="px-4 py-2 font-semibold">{totalQty}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
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
