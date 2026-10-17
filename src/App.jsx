import React, { useEffect, useMemo, useState } from 'react'
import { api, clearSession, getUser, setSession } from './api'
import AIProductAdvice from "./AIProductAdvice.jsx";
import {
  Search, ShoppingBag, Store, MapPin, ShieldCheck, SlidersHorizontal, Package,
  LogOut, Plus, Trash2, Pencil, Sparkles, ArrowRight, CheckCircle2, AlertTriangle,
  TrendingUp, Clock3, BadgeCheck, X, Menu, Boxes, ChevronRight
} from 'lucide-react'

const categories = ['Electronics', 'Home & Office', 'Fashion', 'Beauty', 'Books', 'Grocery', 'Sports', 'Industrial', 'Other']
const initialProduct = {
  name:'', description:'', category:'Electronics', brand:'', model:'', specifications:{},
  price:'', stock:'1', condition:'new', quality_score:'75', warranty_months:'0',
  return_available:true, delivery_days:'3', minimum_order_quantity:'1', image_url:'',
  city:'Belagavi', latitude:'15.8497', longitude:'74.4977', active:true
}
const initialRequirement = {
  product_name:'Wireless Bluetooth Headphones', category:'Electronics', quantity:'1',
  max_budget:'2500', city:'Belagavi', latitude:'15.8497', longitude:'74.4977',
  max_distance_km:'50', mandatory_specs:{}, preferred_specs:{}, allow_alternatives:true, max_delivery_days:'7'
}
function money(n) { return new Intl.NumberFormat('en-IN', { style:'currency', currency:'INR', maximumFractionDigits:2 }).format(Number(n || 0)) }
function Field({ label, children, hint }) { return <label className="field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label> }
function Stat({ icon: Icon, label, value, tone='blue' }) { return <div className="stat"><div className={`stat-icon ${tone}`}><Icon size={18}/></div><div><small>{label}</small><strong>{value}</strong></div></div> }

export default function App() {
  const [user, setUser] = useState(getUser())
  const [page, setPage] = useState('discover')
  const [authMode, setAuthMode] = useState('login')
  const [auth, setAuth] = useState({ name:'', email:'buyer@example.com', password:'BuyerDemo123!', role:'buyer' })
  const [products, setProducts] = useState([])
  const [mine, setMine] = useState([])
  const [query, setQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [productForm, setProductForm] = useState(initialProduct)
  const [editingId, setEditingId] = useState(null)
  const [specText, setSpecText] = useState('connectivity=Bluetooth\ncharging_port=USB-C')
  const [requirement, setRequirement] = useState(initialRequirement)
  const [mandatoryText, setMandatoryText] = useState('')
  const [preferredText, setPreferredText] = useState('connectivity=Bluetooth\ncharging_port=USB-C')
  const [results, setResults] = useState(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState({ type:'', text:'' })
  const [mobileMenu, setMobileMenu] = useState(false)

  const notify = (type, text) => { setNotice({type, text}); window.setTimeout(() => setNotice({type:'', text:''}), 4200) }
  async function loadProducts() {
    try { setProducts(await api('/api/products')) } catch (e) { notify('error', `${e.message}. Is the API running?`) }
  }
  async function loadMine() {
    if (!user || user.role !== 'seller') return
    try { setMine(await api('/api/products/mine')) } catch (e) { notify('error', e.message) }
  }
  useEffect(() => { loadProducts() }, [])
  useEffect(() => { loadMine() }, [user?.id, page])
  const filteredProducts = useMemo(() => products.filter(p =>
    (categoryFilter === 'All' || p.category === categoryFilter) &&
    `${p.name} ${p.description} ${p.brand || ''}`.toLowerCase().includes(query.toLowerCase())
  ), [products, categoryFilter, query])

  async function submitAuth(e) {
    e.preventDefault(); setBusy(true)
    try {
      const path = authMode === 'signup' ? '/api/auth/signup' : '/api/auth/login'
      const body = authMode === 'signup'
        ? { name:auth.name, email:auth.email, password:auth.password, role:auth.role }
        : { email:auth.email, password:auth.password }
      const data = await api(path, { method:'POST', body:JSON.stringify(body) })
      setSession(data.access_token, data.user); setUser(data.user)
      setPage(data.user.role === 'seller' ? 'seller' : 'discover')
      notify('success', `Welcome, ${data.user.name}!`)
    } catch (e2) { notify('error', e2.message) } finally { setBusy(false) }
  }
  function logout() { clearSession(); setUser(null); setPage('discover'); setResults(null); notify('success', 'You have signed out.') }
  function parseSpecs(text) {
    const out = {}
    text.split('\n').map(s => s.trim()).filter(Boolean).forEach(line => {
      const idx = line.indexOf('=')
      if (idx > 0) out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim()
    })
    return out
  }
  function setPF(key, value) { setProductForm(prev => ({...prev, [key]:value})) }
  function setRF(key, value) { setRequirement(prev => ({...prev, [key]:value})) }

  async function saveProduct(e) {
    e.preventDefault()
    if (!user || user.role !== 'seller') return notify('error', 'Sign in with a seller account to manage products.')
    const payload = {
      ...productForm, price:Number(productForm.price), stock:Number(productForm.stock),
      quality_score:Number(productForm.quality_score), warranty_months:Number(productForm.warranty_months),
      delivery_days:Number(productForm.delivery_days), minimum_order_quantity:Number(productForm.minimum_order_quantity),
      latitude:Number(productForm.latitude), longitude:Number(productForm.longitude),
      specifications:parseSpecs(specText), currency:'INR'
    }
    setBusy(true)
    try {
      await api(editingId ? `/api/products/${editingId}` : '/api/products', { method:editingId?'PUT':'POST', body:JSON.stringify(payload) })
      notify('success', editingId ? 'Product updated.' : 'Product listed successfully.')
      setProductForm(initialProduct); setSpecText(''); setEditingId(null)
      await loadProducts(); await loadMine()
    } catch (e2) { notify('error', e2.message) } finally { setBusy(false) }
  }
  function editProduct(p) {
    setEditingId(p.id)
    setProductForm({...p, price:String(p.price), stock:String(p.stock), quality_score:String(p.quality_score), warranty_months:String(p.warranty_months), delivery_days:String(p.delivery_days), minimum_order_quantity:String(p.minimum_order_quantity), latitude:String(p.latitude), longitude:String(p.longitude)})
    setSpecText(Object.entries(p.specifications || {}).map(([k,v]) => `${k}=${v}`).join('\n'))
    setPage('seller'); window.scrollTo({top:0, behavior:'smooth'})
  }
  async function deleteProduct(id) {
    if (!confirm('Delete this product listing?')) return
    try { await api(`/api/products/${id}`, {method:'DELETE'}); notify('success','Listing deleted.'); await loadProducts(); await loadMine() }
    catch(e) { notify('error', e.message) }
  }
  async function runMatch(e) {
    e?.preventDefault(); setBusy(true); setResults(null)
    const payload = {
      ...requirement, quantity:Number(requirement.quantity),
      max_budget:requirement.max_budget === '' ? null : Number(requirement.max_budget),
      max_distance_km:requirement.max_distance_km === '' ? null : Number(requirement.max_distance_km),
      max_delivery_days:requirement.max_delivery_days === '' ? null : Number(requirement.max_delivery_days),
      mandatory_specs:parseSpecs(mandatoryText), preferred_specs:parseSpecs(preferredText),
      latitude:Number(requirement.latitude), longitude:Number(requirement.longitude)
    }
    try {
      if (!user || user.role !== 'buyer') {
        const data = await api('/api/products')
        // Guest demo view is deliberately available; real matching requires an authenticated buyer.
        setResults({eligible:[], alternatives:[], message:'Sign in as a buyer to run the live matching engine.', weights:{}})
        notify('info', 'Sign in as a buyer to run live matching.')
      } else {
        const data = await api('/api/match', {method:'POST', body:JSON.stringify(payload)})
        setResults(data)
        await api('/api/requirements', {method:'POST', body:JSON.stringify(payload)})
      }
    } catch(e2) { notify('error', e2.message) } finally { setBusy(false) }
  }
  function startDemoBuyer() { setAuth({name:'', email:'buyer@example.com', password:'BuyerDemo123!', role:'buyer'}); setAuthMode('login'); setPage('auth') }
  function startDemoSeller() { setAuth({name:'', email:'seller@example.com', password:'SellerDemo123!', role:'seller'}); setAuthMode('login'); setPage('auth') }

  const navItems = [
    {id:'discover', label:'Discover products', icon:Search},
    ...(user?.role === 'buyer' ? [{id:'match', label:'Smart matching', icon:Sparkles}] : []),
    ...(user?.role === 'seller' ? [{id:'seller', label:'Seller studio', icon:Store}] : []),
  ]
  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu?'open':''}`}>
      <button className="brand" onClick={()=>setPage('discover')}><span className="brand-mark"><Boxes size={21}/></span><span>match<span className="brand-accent">mart</span><small>SMART MARKETPLACE</small></span></button>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{navItems.map(item => <button key={item.id} className={`nav-item ${page===item.id?'active':''}`} onClick={()=>{setPage(item.id);setMobileMenu(false)}}><item.icon size={18}/>{item.label}{page===item.id && <ChevronRight size={16} className="nav-chevron"/>}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="match-tip"><div className="tip-icon"><Sparkles size={17}/></div><strong>Smarter decisions</strong><p>Compare fit, cost, quality and proximity in one place.</p></div>
        <div className="sidebar-profile">
          <div className="avatar">{user?.name?.[0]?.toUpperCase() || 'G'}</div>
          <div className="profile-info"><strong>{user?.name || 'Guest explorer'}</strong><small>{user?.role ? `${user.role} account` : 'Browse marketplace'}</small></div>
          {user ? <button className="icon-btn" title="Sign out" onClick={logout}><LogOut size={17}/></button> : <button className="tiny-link" onClick={()=>setPage('auth')}>Sign in</button>}
        </div>
      </div>
    </aside>
    <main className="main">
      <header className="topbar">
        <button className="mobile-menu icon-btn" onClick={()=>setMobileMenu(!mobileMenu)}><Menu size={20}/></button>
        <div className="breadcrumb">Marketplace <span>/</span> <strong>{page==='discover'?'Discover':page==='match'?'Smart matching':page==='seller'?'Seller studio': 'Account'}</strong></div>
        <div className="top-actions"><span className="secure-pill"><ShieldCheck size={15}/> Smart recommendations</span>{!user && <button className="btn btn-dark btn-sm" onClick={()=>setPage('auth')}>Sign in <ArrowRight size={15}/></button>}</div>
      </header>
      {notice.text && <div className={`toast ${notice.type}`}><span>{notice.text}</span><button onClick={()=>setNotice({type:'',text:''})}><X size={15}/></button></div>}
      {page==='discover' && <section className="page-content">
        <div className="hero">
          <div className="hero-copy"><div className="eyebrow"><Sparkles size={14}/> A BETTER WAY TO BUY</div><h1>Find the right product.<br/><span>Not just the lowest price.</span></h1><p>Compare real options across price, specifications, distance and seller information — then choose with confidence.</p>
            <div className="hero-buttons"><button className="btn btn-primary" onClick={()=>{if(user?.role==='buyer')setPage('match');else setPage('auth')}}>Start smart matching <ArrowRight size={17}/></button><button className="btn btn-ghost" onClick={()=>document.getElementById('catalog')?.scrollIntoView({behavior:'smooth'})}>Explore products</button></div>
            <div className="hero-trust"><span><CheckCircle2 size={15}/> Explainable scores</span><span><CheckCircle2 size={15}/> Compatibility first</span><span><CheckCircle2 size={15}/> Location aware</span></div>
          </div>
          <div className="hero-art"><div className="art-orbit orbit-one"></div><div className="art-orbit orbit-two"></div><div className="floating-card card-top"><span className="mini-dot green"></span><span>Compatibility checked</span><CheckCircle2 size={17}/></div><div className="product-visual"><div className="visual-glow"></div><ShoppingBag size={76} strokeWidth={1.1}/><span>BEST FIT</span></div><div className="floating-card card-bottom"><div className="score-ring">94</div><div><strong>Match score</strong><small>Price · quality · distance</small></div><TrendingUp size={18}/></div></div>
        </div>
        <div className="stat-row"><Stat icon={Boxes} label="Product categories" value="Flexible" tone="blue"/><Stat icon={SlidersHorizontal} label="Ranking factors" value="7+ factors" tone="purple"/><Stat icon={MapPin} label="Location aware" value="Nearby options" tone="orange"/><Stat icon={ShieldCheck} label="Matching approach" value="Explainable" tone="green"/></div>
        <section id="catalog" className="catalog-section">
          <div className="section-heading"><div><div className="eyebrow">MARKETPLACE</div><h2>Explore products</h2><p>Browse listings from sellers, then sign in to compare them against your requirements.</p></div><span className="count-pill">{filteredProducts.length} listings</span></div>
          <div className="catalog-tools"><div className="searchbox"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search products, brands or descriptions..."/></div><select value={categoryFilter} onChange={e=>setCategoryFilter(e.target.value)}><option>All</option>{categories.map(c=><option key={c}>{c}</option>)}</select></div>
          <div className="product-grid">{filteredProducts.map(p=><ProductCard key={p.id} product={p} onMatch={()=>{setRequirement(r=>({...r,product_name:p.name,category:p.category})); if(user?.role==='buyer')setPage('match');else setPage('auth')}}/>)}</div>
          {filteredProducts.length===0 && <EmptyState title="No listings found" text="Try another search or category."/>}
        </section>
      </section>}
      {page==='auth' && <section className="auth-page"><div className="auth-side"><div className="eyebrow"><Sparkles size={14}/> MATCH SMARTER</div><h1>Good decisions<br/>start with <span>better matches.</span></h1><p>One marketplace for buyers and sellers, with transparent recommendations built around what matters to you.</p><div className="auth-benefits"><span><CheckCircle2/> Product fit before price</span><span><CheckCircle2/> Compare nearby sellers</span><span><CheckCircle2/> Know why a match ranks</span></div></div><form className="auth-card" onSubmit={submitAuth}><div className="auth-card-icon"><ShieldCheck size={24}/></div><h2>{authMode==='login'?'Welcome back':'Create your account'}</h2><p>{authMode==='login'?'Sign in to continue to MatchMart.':'Choose how you want to use the marketplace.'}</p>
        {authMode==='signup' && <><Field label="Full name"><input required minLength="2" value={auth.name} onChange={e=>setAuth({...auth,name:e.target.value})} placeholder="Your name"/></Field><Field label="Account type"><select value={auth.role} onChange={e=>setAuth({...auth,role:e.target.value})}><option value="buyer">Buyer — find products</option><option value="seller">Seller — list products</option></select></Field></>}
        <Field label="Email address"><input type="email" required value={auth.email} onChange={e=>setAuth({...auth,email:e.target.value})} placeholder="you@example.com"/></Field><Field label="Password" hint={authMode==='signup'?'Use at least 10 characters.':'Demo accounts are prefilled for convenience.'}><input type="password" required minLength={authMode==='signup'?10:1} value={auth.password} onChange={e=>setAuth({...auth,password:e.target.value})}/></Field>
        <button className="btn btn-primary btn-wide" disabled={busy}>{busy?'Please wait...':authMode==='login'?'Sign in securely':'Create account'} <ArrowRight size={17}/></button>
        <div className="auth-switch">{authMode==='login'?'New to MatchMart?':'Already have an account?'} <button type="button" onClick={()=>{setAuthMode(authMode==='login'?'signup':'login');setAuth({...auth,password:''})}}>{authMode==='login'?'Create account':'Sign in'}</button></div>
        <div className="demo-box"><strong>Demo accounts</strong><button type="button" onClick={startDemoBuyer}>Buyer demo <span>buyer@example.com</span></button><button type="button" onClick={startDemoSeller}>Seller demo <span>seller@example.com</span></button><small>Demo password: BuyerDemo123! or SellerDemo123!</small></div>
      </form></section>}
      {page==='match' && <section className="page-content">
        <div className="page-title-row"><div><div className="eyebrow"><Sparkles size={14}/> MATCHING ENGINE</div><h1>What are you looking for?</h1><p>Set your must-haves and preferences. Mandatory requirements are checked before ranking.</p></div><span className="live-label"><span></span> Multi-factor analysis</span></div>
        {user?.role!=='buyer' && <div className="inline-alert"><AlertTriangle size={18}/><span>Sign in with a buyer account to run live matches. <button onClick={()=>setPage('auth')}>Sign in</button></span></div>}
        <form className="match-layout" onSubmit={runMatch}><div className="panel requirement-panel"><div className="panel-head"><span className="panel-icon"><Search size={18}/></span><div><h3>Product requirements</h3><p>Tell us what a good match looks like.</p></div></div>
          <div className="form-grid"><Field label="Product name"><input required value={requirement.product_name} onChange={e=>setRF('product_name',e.target.value)} placeholder="e.g. wireless headphones"/></Field><Field label="Category"><select value={requirement.category} onChange={e=>setRF('category',e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field><Field label="Quantity"><input type="number" min="1" required value={requirement.quantity} onChange={e=>setRF('quantity',e.target.value)}/></Field><Field label="Maximum budget (₹)" hint="Total product cost for the requested quantity"><input type="number" min="1" value={requirement.max_budget} onChange={e=>setRF('max_budget',e.target.value)} placeholder="No limit"/></Field><Field label="Delivery city"><input required value={requirement.city} onChange={e=>setRF('city',e.target.value)}/></Field><Field label="Maximum distance (km)"><input type="number" min="1" value={requirement.max_distance_km} onChange={e=>setRF('max_distance_km',e.target.value)} placeholder="Any distance"/></Field><Field label="Latitude"><input type="number" step="any" required value={requirement.latitude} onChange={e=>setRF('latitude',e.target.value)}/></Field><Field label="Longitude"><input type="number" step="any" required value={requirement.longitude} onChange={e=>setRF('longitude',e.target.value)}/></Field><Field label="Latest acceptable delivery (days)"><input type="number" min="0" value={requirement.max_delivery_days} onChange={e=>setRF('max_delivery_days',e.target.value)}/></Field></div>
          <div className="field"><span>Mandatory specifications</span><textarea rows="3" value={mandatoryText} onChange={e=>setMandatoryText(e.target.value)} placeholder={'One per line, key=value\nExample: material=Stainless Steel\ndiameter=M8'}/><small>Any missing or different mandatory value makes a listing an alternative, not an exact eligible result.</small></div>
          <div className="field"><span>Preferred specifications</span><textarea rows="3" value={preferredText} onChange={e=>setPreferredText(e.target.value)} placeholder={'connectivity=Bluetooth\ncolor=Black'}/><small>Preferred features affect the product-fit score but do not automatically disqualify a product.</small></div>
          <label className="check-row"><input type="checkbox" checked={requirement.allow_alternatives} onChange={e=>setRF('allow_alternatives',e.target.checked)}/><span><strong>Show alternatives separately</strong><small>Include products that fail one or more constraints, with warnings.</small></span></label>
          <button className="btn btn-primary btn-wide" disabled={busy}>{busy?'Analysing listings...':'Analyse matches'} <Sparkles size={17}/></button>
        </div><div className="panel factors-panel"><div className="panel-head"><span className="panel-icon purple"><SlidersHorizontal size={18}/></span><div><h3>What we compare</h3><p>Transparent starting weights</p></div></div>
          {[['Product fit & specs',30],['Total cost efficiency',20],['Quality evidence',15],['Seller proximity',10],['Seller reliability',10],['Stock & delivery',10],['Warranty & returns',5]].map(([label,n])=><div className="factor" key={label}><div><span>{label}</span><strong>{n}%</strong></div><div className="progress"><span style={{width:`${n}%`}}/></div></div>)}
          <div className="factor-note"><ShieldCheck size={17}/><span>Mandatory compatibility checks happen before ranking. A low price cannot override an incompatible specification.</span></div>
               </div>
        </form>

        <AIProductAdvice
          requirement={{
            ...requirement,
            quantity: Number(requirement.quantity),
            max_budget: requirement.max_budget === ''
              ? null
              : Number(requirement.max_budget),
            max_distance_km: requirement.max_distance_km === ''
              ? null
              : Number(requirement.max_distance_km),
            max_delivery_days: requirement.max_delivery_days === ''
              ? null
              : Number(requirement.max_delivery_days),
            mandatory_specs: parseSpecs(mandatoryText),
            preferred_specs: parseSpecs(preferredText),
            latitude: Number(requirement.latitude),
            longitude: Number(requirement.longitude)
          }}
        />

        {results && (
          <section className="results-section">
            <div className="section-heading">
              <div>
                <div className="eyebrow">ANALYSIS RESULTS</div>
                <h2>Recommended matches</h2>
                <p>{results.message}</p>
              </div>
              <span className="count-pill">
                {results.eligible?.length || 0} eligible
              </span>
            </div>

            {results.eligible?.length ? (
              <div className="results-list">
                {results.eligible.map((r, i) => (
                  <MatchCard
                    key={r.product.id}
                    result={r}
                    index={i}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                title="No exact eligible matches"
                text="Try widening your budget or distance, removing optional constraints, or checking seller listings."
              />
            )}

            {results.alternatives?.length > 0 && (
              <>
                <div className="section-heading alt-heading">
                  <div>
                    <div className="eyebrow">REVIEW BEFORE CHOOSING</div>
                    <h2>Possible alternatives</h2>
                    <p>
                      These listings failed one or more constraints and are not exact matches.
                    </p>
                  </div>
                  <span className="count-pill warning-count">
                    {results.alternatives.length} alternatives
                  </span>
                </div>

                <div className="results-list">
                  {results.alternatives.map((r, i) => (
                    <MatchCard
                      key={r.product.id}
                      result={r}
                      index={i}
                      alternative
                    />
                  ))}
                </div>
              </>
            )}
          </section>
        )}
      </section>}
      {page==='seller' && <section className="page-content">
        <div className="page-title-row"><div><div className="eyebrow"><Store size={14}/> SELLER WORKSPACE</div><h1>Manage your listings</h1><p>Add accurate details to help buyers find the right product.</p></div><span className="live-label"><span></span> Seller studio</span></div>
        {user?.role!=='seller' ? <div className="panel seller-gate"><Store size={32}/><h2>Seller account required</h2><p>Sign in or create a seller account to manage product listings.</p><button className="btn btn-primary" onClick={()=>setPage('auth')}>Continue to account <ArrowRight size={16}/></button></div> :
        <div className="seller-layout"><form className="panel seller-form" onSubmit={saveProduct}><div className="panel-head"><span className="panel-icon"><Plus size={18}/></span><div><h3>{editingId?'Edit product':'Add a new product'}</h3><p>Clear specifications lead to better recommendations.</p></div></div>
          <div className="form-grid"><Field label="Product name"><input required minLength="2" value={productForm.name} onChange={e=>setPF('name',e.target.value)}/></Field><Field label="Category"><select value={productForm.category} onChange={e=>setPF('category',e.target.value)}>{categories.map(c=><option key={c}>{c}</option>)}</select></Field><Field label="Brand"><input value={productForm.brand||''} onChange={e=>setPF('brand',e.target.value)}/></Field><Field label="Model / SKU"><input value={productForm.model||''} onChange={e=>setPF('model',e.target.value)}/></Field><Field label="Price per unit (₹)"><input required type="number" min=".01" step=".01" value={productForm.price} onChange={e=>setPF('price',e.target.value)}/></Field><Field label="Available stock"><input required type="number" min="0" value={productForm.stock} onChange={e=>setPF('stock',e.target.value)}/></Field><Field label="Minimum order quantity"><input type="number" min="1" value={productForm.minimum_order_quantity} onChange={e=>setPF('minimum_order_quantity',e.target.value)}/></Field><Field label="Condition"><select value={productForm.condition} onChange={e=>setPF('condition',e.target.value)}><option value="new">New</option><option value="used">Used</option><option value="refurbished">Refurbished</option></select></Field><Field label="Quality evidence score (0–100)" hint="Demo input; production should use verified evidence"><input type="number" min="0" max="100" value={productForm.quality_score} onChange={e=>setPF('quality_score',e.target.value)}/></Field><Field label="Warranty (months)"><input type="number" min="0" value={productForm.warranty_months} onChange={e=>setPF('warranty_months',e.target.value)}/></Field><Field label="Delivery estimate (days)"><input type="number" min="0" value={productForm.delivery_days} onChange={e=>setPF('delivery_days',e.target.value)}/></Field><Field label="City"><input required value={productForm.city} onChange={e=>setPF('city',e.target.value)}/></Field><Field label="Latitude"><input required type="number" step="any" value={productForm.latitude} onChange={e=>setPF('latitude',e.target.value)}/></Field><Field label="Longitude"><input required type="number" step="any" value={productForm.longitude} onChange={e=>setPF('longitude',e.target.value)}/></Field><Field label="Image URL"><input type="url" value={productForm.image_url||''} onChange={e=>setPF('image_url',e.target.value)} placeholder="https://..."/></Field></div>
          <Field label="Description"><textarea rows="3" value={productForm.description} onChange={e=>setPF('description',e.target.value)} placeholder="Describe intended use, features and condition."/></Field><Field label="Specifications (key=value, one per line)"><textarea rows="4" value={specText} onChange={e=>setSpecText(e.target.value)} placeholder={'material=Stainless Steel\ndiameter=M8\ngrade=A2-70'}/></Field>
          <label className="check-row"><input type="checkbox" checked={productForm.return_available} onChange={e=>setPF('return_available',e.target.checked)}/><span><strong>Returns available</strong><small>Only enable this if your stated policy allows returns.</small></span></label>
          <div className="form-actions"><button className="btn btn-primary" disabled={busy}>{busy?'Saving...':editingId?'Save changes':'Publish listing'} <ArrowRight size={16}/></button>{editingId && <button type="button" className="btn btn-ghost" onClick={()=>{setEditingId(null);setProductForm(initialProduct);setSpecText('')}}>Cancel edit</button>}</div>
        </form><div className="seller-list-panel"><div className="panel seller-list-head"><div><h3>Your products</h3><p>{mine.length} active or inactive listings</p></div><span className="count-pill">{mine.length}</span></div>{mine.map(p=><div className="seller-product" key={p.id}><div className="seller-product-thumb">{p.image_url?<img src={p.image_url} alt=""/>:<Package/>}</div><div className="seller-product-info"><strong>{p.name}</strong><small>{p.category} · Stock {p.stock}</small><b>{money(p.price)}</b></div><button className="icon-btn" title="Edit" onClick={()=>editProduct(p)}><Pencil size={16}/></button><button className="icon-btn danger" title="Delete" onClick={()=>deleteProduct(p.id)}><Trash2 size={16}/></button></div>)}{mine.length===0&&<EmptyState title="No products yet" text="Add your first listing using the form."/>}</div></div>}
      </section>}
      <footer className="footer"><span>© 2026 MatchMart</span><span>Transparent matching · Buyer-first recommendations</span><span>Demo build</span></footer>
    </main>
  </div>
}

function ProductCard({product:p,onMatch}) {
  return <article className="product-card"><div className="product-image">{p.image_url?<img src={p.image_url} alt={p.name} loading="lazy" onError={e=>{e.currentTarget.style.display='none'}}/>:<div className="image-fallback"><Package size={40}/></div>}<span className="category-chip">{p.category}</span>{p.stock===0&&<span className="stock-chip">Out of stock</span>}</div><div className="product-card-body"><div className="product-brand">{p.brand || 'Independent seller'}</div><h3>{p.name}</h3><div className="product-meta"><span><MapPin size={14}/>{p.city}</span><span><Boxes size={14}/>Stock {p.stock}</span></div><div className="product-card-bottom"><div><strong>{money(p.price)}</strong><small>per unit</small></div><button className="round-arrow" onClick={onMatch} title="Match this product"><ArrowRight size={17}/></button></div></div></article>
}
function MatchCard({result:r,index,alternative=false}) {
  const p=r.product
  return <article className={`match-card ${alternative?'alternative':''}`}><div className="match-rank">{alternative?'ALT':String(index+1).padStart(2,'0')}</div><div className="match-product-image">{p.image_url?<img src={p.image_url} alt={p.name}/>:<Package size={28}/>}</div><div className="match-main"><div className="match-title-row"><h3>{p.name}</h3>{!alternative&&index===0&&<span className="best-chip"><Sparkles size={13}/> Best overall</span>}</div><div className="match-tags"><span><Store size={13}/>{r.seller.name}</span><span><MapPin size={13}/>{r.distance_km} km away</span><span><Boxes size={13}/>{p.stock} in stock</span></div><p className="match-description">{p.description || 'No description supplied.'}</p><div className="score-breakdown">{Object.entries(r.score_breakdown).map(([key,value])=><div key={key} title={`${key.replaceAll('_',' ')}: ${value}/100`}><span>{key.replaceAll('_',' ')}</span><div className="progress"><span style={{width:`${value}%`}}/></div><b>{Math.round(value)}</b></div>)}</div><div className="match-explanations">{r.explanation.map((x,i)=><span key={i}><CheckCircle2 size={13}/>{x}</span>)}</div>{r.warnings?.length>0&&<div className="warnings">{r.warnings.map((w,i)=><span key={i}><AlertTriangle size={13}/>{w}</span>)}</div>}</div><div className="match-side"><div className="score-bubble" style={{'--score':`${r.score}%`}}><strong>{r.score}</strong><small>match</small></div><div className="match-price"><strong>{money(r.total_cost)}</strong><small>estimated subtotal</small></div><div className="seller-trust">{r.seller.verified?<BadgeCheck size={14}/>:<ShieldCheck size={14}/>} {r.seller.verified?'Seller verified':'Seller profile'}<small>Reliability {r.seller.reliability_score}/100</small></div></div></article>
}
function EmptyState({title,text}) { return <div className="empty-state"><div><Search size={24}/></div><strong>{title}</strong><p>{text}</p></div> }
