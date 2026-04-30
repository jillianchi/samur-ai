import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { mppFetch, walletAddress } from '../mpp-client'

// ── ERP product queue ─────────────────────────────────────────────────────────
const ERP_PRODUCTS = [
  { id: 1, sku: 'KB-001', name: 'Bamboo Cutting Board Set', category: 'Kitchen & Dining', brand: 'EcoChef', platform: 'Amazon',
    attributes: { material: 'Organic Moso bamboo', variants: '3-piece set (S/M/L)', features: ['deep juice groove', 'eco-friendly', 'dishwasher safe'], dimensions: 'S 25×15cm, M 35×25cm, L 45×30cm' } },
  { id: 2, sku: 'EL-042', name: 'Wireless Noise-Cancelling Earbuds', category: 'Consumer Electronics', brand: 'SoundCore', platform: 'Shopify',
    attributes: { connectivity: 'Bluetooth 5.3', battery: '12h earbuds + 36h case (48h total)', features: ['ANC', 'IPX5 waterproof', 'USB-C charging', 'multipoint pairing'], weight: '5.6g per earbud' } },
  { id: 3, sku: 'HM-017', name: 'Vanilla Sandalwood Soy Candle', category: 'Home Fragrance', brand: 'ArtisanWax', platform: 'Etsy',
    attributes: { material: '100% natural soy wax', fragrance: 'vanilla & sandalwood', burnTime: '50 hours', origin: 'Hand-poured in Singapore' } },
  { id: 4, sku: 'SP-099', name: 'Non-Slip Yoga Mat', category: 'Sports & Fitness', brand: 'ZenFlex', platform: 'Lazada',
    attributes: { material: 'TPE (Thermoplastic Elastomer)', thickness: '6mm', dimensions: '183 × 61cm', features: ['alignment lines', 'non-slip surface', 'carry strap included'] } },
  { id: 5, sku: 'OF-023', name: 'Standing Desk Converter', category: 'Office Furniture', brand: 'ErgoRise', platform: 'Amazon',
    attributes: { heightRange: '15–45cm adjustable', surfaceWidth: '70cm', capacity: 'Dual 27" monitors, up to 15kg', features: ['gas spring lift', 'cable management', 'no assembly required'] } },
]

const DEFAULT_INSTRUCTION = `Generate a marketplace-ready product listing for each product in the queue. Optimise the copy for each platform's specific requirements and audience.`

function productToDescription(product) {
  const a = product.attributes
  return [`Product: ${product.name}`, `Brand: ${product.brand}`, `Category: ${product.category}`,
    ...Object.entries(a).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)].join('\n')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Spinner({ size = 14 }) {
  return (
    <svg className="animate-spin" style={{ width: size, height: size }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  )
}

function timeAgo(isoString) {
  const s = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000)
  if (s < 60) return `${s}s ago`
  return `${Math.floor(s / 60)}m ago`
}

// ── Name modal ────────────────────────────────────────────────────────────────

function NameModal({ onSet, defaultName = '' }) {
  const [name, setName] = useState(defaultName)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.55)' }}>
      <div className="rounded-2xl p-8 w-full max-w-sm shadow-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="text-lg font-semibold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
          {defaultName ? 'Change your name' : 'Welcome to SamurAI'}
        </h2>
        <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>What's your name for this session?</p>
        <form onSubmit={e => { e.preventDefault(); const t = name.trim(); if (t) { localStorage.setItem('samurai-name', t); onSet(t) } }} className="flex flex-col gap-3">
          <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Alice"
            className="w-full px-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--text)' }} />
          <button type="submit" disabled={!name.trim()}
            className="w-full py-2 rounded-lg text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'var(--blurple)' }}>{defaultName ? 'Save' : 'Start'}</button>
        </form>
      </div>
    </div>
  )
}

// ── Preset MPP agents (fake, for discovery demo) ──────────────────────────────
const PRESET_AGENTS = [
  { id: 'preset-1', name: 'Katalyst', author: 'Nexus Labs', url: 'https://katalyst.nexuslabs.io' },
  { id: 'preset-2', name: 'Vexor AI', author: 'Mercury Systems', url: 'https://api.vexor.ai' },
]

// ── Left panel: product queue + agent settings ────────────────────────────────

function QueuePanel({ productState, apiUrl, onSetApiUrl }) {
  const [showSettings, setShowSettings] = useState(false)
  const [customName, setCustomName] = useState(() => localStorage.getItem('agent-custom-name') || '')
  const [customUrl, setCustomUrl] = useState(() => localStorage.getItem('agent-endpoint') || '')
  const STATUS_DOT = {
    idle:       { color: 'var(--text-faint)', label: '○' },
    generating: { color: 'var(--blurple)',    label: '⟳' },
    done:       { color: '#059669',           label: '✓' },
    error:      { color: '#dc2626',           label: '✗' },
  }

  async function saveSettings() {
    let resolvedName = customName
    // Fetch real name + price from openapi.json if URL is set
    if (customUrl) {
      try {
        const res = await fetch(`${customUrl}/openapi.json`)
        if (res.ok) {
          const spec = await res.json()
          const title = spec.info?.title
          const price = spec.paths?.['/generate']?.post?.['x-payment-info']?.price
          if (title && !customName) { resolvedName = title; setCustomName(title) }
          if (price) localStorage.setItem('agent-detected-price', price)
        }
      } catch { /* silent — manual name still works */ }
    }
    localStorage.setItem('agent-custom-name', resolvedName)
    localStorage.setItem('agent-endpoint', customUrl)
    onSetApiUrl(customUrl)
    setShowSettings(false)
  }

  const allAgents = [...PRESET_AGENTS, { id: 'custom', name: customName || 'Your endpoint', author: 'You', url: customUrl, fake: false }]

  return (
    <div className="h-full flex flex-col" style={{ borderRight: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <p className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>Product Queue</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>{ERP_PRODUCTS.length} new items from ERP</p>
      </div>

      {/* Products */}
      <div className="flex-1 overflow-y-auto py-2">
        {ERP_PRODUCTS.map(product => {
          const state = productState[product.id]
          const dot = STATUS_DOT[state.status] || STATUS_DOT.idle
          return (
            <div key={product.id} className="px-4 py-2.5">
              <div className="flex items-start gap-2">
                <span className="text-sm mt-0.5 shrink-0 font-mono" style={{ color: dot.color }}>{dot.label}</span>
                <div className="min-w-0">
                  <p className="text-xs font-medium leading-snug" style={{ color: 'var(--text)' }}>{product.name}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                    {product.sku} · {product.platform}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Settings trigger */}
      <div style={{ borderTop: '1px solid var(--border)' }}>
        <button onClick={() => setShowSettings(v => !v)}
          className="w-full flex items-center gap-2 px-4 py-3 transition-colors text-left"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
          onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
          <span className="text-xs font-medium">Simulation</span>
          <svg className={`w-3 h-3 ml-auto transition-transform ${showSettings ? 'rotate-180' : ''}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </button>

        {showSettings && (
          <div className="px-4 pb-4 space-y-2.5" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
            <p className="text-[10px] font-semibold uppercase tracking-widest pt-3" style={{ color: 'var(--text-faint)' }}>
              MPP-Compliant Agents
            </p>

            {/* Preset agents — read only */}
            {PRESET_AGENTS.map(agent => (
              <div key={agent.id} className="flex items-start gap-2">
                <span className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>○</span>
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{agent.name}</p>
                  <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>by {agent.author}</p>
                </div>
              </div>
            ))}

            {/* User's own agent */}
            <div className="flex items-start gap-2">
              <span className="text-xs mt-0.5" style={{ color: 'var(--blurple)' }}>●</span>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>
                    {customName || 'Your agent'}
                  </p>
                  <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>by you</p>
                </div>
                <input value={customName} onChange={e => setCustomName(e.target.value)}
                  placeholder="Agent name (e.g. ListingBot by Alice)"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)' }} />
                <input value={customUrl} onChange={e => setCustomUrl(e.target.value)}
                  placeholder="https://your-lambda-url.amazonaws.com"
                  className="w-full px-2.5 py-1.5 rounded-lg text-xs outline-none"
                  style={{ background: 'var(--bg)', border: '1px solid var(--border)', color: 'var(--text)', fontFamily: 'var(--font-mono)' }} />
<button onClick={saveSettings}
                  className="w-full py-1.5 rounded-lg text-xs font-medium text-white"
                  style={{ background: 'var(--blurple)' }}>Save</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Chat messages ─────────────────────────────────────────────────────────────

const REFINE_LABELS = [
  'Improving the flow…',
  'Adding a WOW factor…',
  'Making it pop for the platform…',
  'Sharpening the hooks…',
  'Did you say local flavour?',
  'Dialling up the energy…',
  'Punching up the benefits…',
  'Tweaking for maximum impact…',
]

function RefiningLabel() {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % REFINE_LABELS.length), 1800)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--blurple)' }}>
      <Spinner size={11} />
      <span className="transition-opacity">{REFINE_LABELS[idx]}</span>
    </div>
  )
}

function AgentMessage({ product, state, onRefine, onRetry }) {
  const [expanded, setExpanded] = useState(true)
  const [showOriginal, setShowOriginal] = useState(false)
  const [feedback, setFeedback] = useState('')
  const displayListing = showOriginal ? state.originalListing : state.listing

  function submitFeedback() {
    if (!feedback.trim()) return
    onRefine(feedback.trim())
    setFeedback('')
  }

  return (
    <div className="flex items-start gap-3">
      <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white mt-0.5"
        style={{ background: 'var(--blurple)' }}>
        AI
      </div>

      <div className="flex-1 min-w-0">
        <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)', maxWidth: '640px' }}>

          {(state.status === 'generating') && (
            <div className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
              <Spinner size={12} />
              <span>Processing <span className="font-medium" style={{ color: 'var(--text)' }}>{product.name}</span> for {product.platform}…</span>
            </div>
          )}

          {state.status === 'refine-error' && state.listing && (
            <div className="space-y-2">
              <p className="font-semibold leading-snug" style={{ color: 'var(--text)' }}>{state.listing.title}</p>
              <p className="text-[12px]" style={{ color: '#dc2626' }}>
                Refinement failed: {state.error} — try a different prompt.
              </p>
            </div>
          )}

          {state.status === 'refining' && state.listing && (
            <div className="space-y-2">
              <p className="font-semibold leading-snug" style={{ color: 'var(--text)' }}>{state.listing.title}</p>
              <RefiningLabel />
            </div>
          )}

          {state.status === 'done' && displayListing && (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--blurple)', opacity: 0.7 }}>
                      {product.name} · {product.platform}
                    </p>
                    {state.originalListing && (
                      <button onClick={() => setShowOriginal(v => !v)}
                        className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
                        style={{ color: showOriginal ? 'var(--blurple)' : 'var(--text-faint)', background: 'var(--bg-card)' }}>
                        {showOriginal ? '← original' : '✦ refined'}
                      </button>
                    )}
                  </div>
                  <p className="font-semibold leading-snug" style={{ color: 'var(--text)' }}>{displayListing.title}</p>
                </div>
                <button onClick={() => setExpanded(v => !v)}
                  className="text-[11px] shrink-0 px-2 py-1 rounded-lg"
                  style={{ color: 'var(--text-faint)', background: 'var(--bg-card)' }}>
                  {expanded ? 'Less' : 'More'}
                </button>
              </div>

              {expanded && (
                <div className="mt-3 space-y-2">
                  {displayListing.description && (
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{displayListing.description}</p>
                  )}
                  {displayListing.features?.length > 0 && (
                    <ul className="space-y-1">
                      {displayListing.features.slice(0, 3).map((f, i) => (
                        <li key={i} className="text-[12px] flex items-start gap-1.5" style={{ color: 'var(--text-muted)' }}>
                          <span style={{ color: 'var(--blurple)', opacity: 0.5 }}>◆</span>{f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <div className="mt-2 pt-2 flex items-center gap-2" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-[11px]" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                  {state.pricePaid || '$0.01 USDC'} · {product.sku}
                  {state.originalListing && !showOriginal && <span style={{ color: 'var(--blurple)', marginLeft: 6 }}>✦ refined</span>}
                </span>
              </div>

              {/* Inline feedback input */}
              <div className="mt-3 flex items-center gap-2">
                <input
                  value={feedback}
                  onChange={e => setFeedback(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') submitFeedback() }}
                  placeholder="Give feedback to refine… e.g. make it more casual"
                  className="flex-1 px-3 py-2 rounded-xl text-xs outline-none"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text)' }}
                />
                <button onClick={submitFeedback} disabled={!feedback.trim()}
                  className="px-3 py-2 rounded-xl text-xs font-medium text-white transition-all disabled:opacity-30"
                  style={{ background: 'var(--blurple)', whiteSpace: 'nowrap' }}>
                  Refine ↑
                </button>
              </div>
            </div>
          )}

          {state.status === 'error' && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-[13px]" style={{ color: '#dc2626' }}>
                {state.error?.includes('fetch') ? 'Could not reach endpoint — check it\'s deployed and the URL is correct.' : `Failed: ${state.error}`}
              </p>
              {onRetry && (
                <button onClick={onRetry}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg shrink-0 transition-colors"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                  ↺ Retry
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InstructionMessage({ text }) {
  return (
    <div className="flex justify-end">
      <div className="rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-lg"
        style={{ background: 'var(--blurple)', color: '#fff' }}>
        {text}
      </div>
    </div>
  )
}

function DiscoveryMessage({ text, done }) {
  const isSelected = text.startsWith('Selected:')
  return (
    <div className="flex items-center gap-2 pl-10 py-0.5">
      {done
        ? <span style={{ color: isSelected ? '#059669' : 'var(--text-faint)', fontSize: 12 }}>{isSelected ? '✓' : '·'}</span>
        : <Spinner size={11} />
      }
      <span className="text-[13px]" style={{ color: isSelected && done ? '#059669' : 'var(--text-muted)' }}>
        {text}
      </span>
    </div>
  )
}

// ── Live feed ─────────────────────────────────────────────────────────────────

function LiveFeed({ resultsUrl }) {
  const [results, setResults] = useState([])
  const [live, setLive] = useState(false)
  const [open, setOpen] = useState(false)
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!resultsUrl) return
    async function poll() {
      try {
        const res = await fetch(`${resultsUrl}/results`)
        if (!res.ok) return
        const data = await res.json()
        setResults(data.results || [])
        setLive(true)
      } catch { setLive(false) }
    }
    poll()
    intervalRef.current = setInterval(poll, 3000)
    return () => clearInterval(intervalRef.current)
  }, [resultsUrl])

  if (!resultsUrl) return null

  return (
    <div>
      {/* Collapsible toggle row */}
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 py-1.5 transition-opacity hover:opacity-70">
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
          Live Feed
        </span>
        {live && <span className="flex items-center gap-1 text-[11px]" style={{ color: '#059669' }}>
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          {results.length > 0 ? `${results.length} results` : 'Live'}
        </span>}
        <svg className={`w-3 h-3 ml-auto transition-transform ${open ? '' : '-rotate-90'}`}
          style={{ color: 'var(--text-faint)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {open && results.length > 0 && (
        <div className="rounded-xl overflow-hidden mb-1" style={{ border: '1px solid var(--border)', maxHeight: '240px', overflowY: 'auto' }}>
          {/* Header */}
          <div className="grid px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ gridTemplateColumns: '8rem 1fr 4.5rem 5.5rem 4rem', color: 'var(--text-faint)', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)' }}>
            <span>Agent</span><span>Product</span><span>Platform</span><span className="text-right">Paid</span><span className="text-right">When</span>
          </div>
          {results.map((r, i) => (
            <div key={r.resultId || i} className="grid items-center px-4 py-2 text-[12px]"
              style={{ gridTemplateColumns: '8rem 1fr 4.5rem 5.5rem 4rem', borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span className="font-medium truncate" style={{ color: 'var(--text)' }}>{r.participantName}</span>
              <span className="truncate px-2" style={{ color: 'var(--text-muted)' }}>{r.productName}</span>
              <span className="truncate" style={{ color: 'var(--text-faint)' }}>{r.platform}</span>
              <span className="text-right" style={{ color: '#059669', fontFamily: 'var(--font-mono)', fontSize: '11px' }}>
                {r.pricePaid || '$0.01 USDC'}
              </span>
              <span className="text-right text-[11px]" style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                {r.createdAt ? timeAgo(r.createdAt) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}

      {open && results.length === 0 && (
        <p className="text-xs pb-1" style={{ color: 'var(--text-faint)' }}>No results yet.</p>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AgentRunner() {
  const { logApiCall, updateApiCall, fetchListings, queueOpen } = useApp()
  const [participantName, setParticipantName] = useState(() => localStorage.getItem('samurai-name') || null)
  const [showNameModal, setShowNameModal] = useState(() => !localStorage.getItem('samurai-name'))
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('agent-endpoint') || import.meta.env.VITE_API_URL || '')
  const [instruction, setInstruction] = useState(DEFAULT_INSTRUCTION)
  const [productState, setProductState] = useState(() =>
    Object.fromEntries(ERP_PRODUCTS.map(p => [p.id, { status: 'idle', listing: null, error: null, pricePaid: null, originalListing: null }]))
  )
  const [messages, setMessages] = useState([])
  const [totalSpent, setTotalSpent] = useState(0)
  const [running, setRunning] = useState(false)
  const [summary, setSummary] = useState(null)
  const [walletBalance, setWalletBalance] = useState(null)
  const chatBottomRef = useRef(null)
  const resultsUrl = import.meta.env.VITE_RESULTS_URL

  useEffect(() => {
    if (!walletAddress) return
    async function fetchBalance() {
      try {
        const data = '0x70a08231' + walletAddress.slice(2).toLowerCase().padStart(64, '0')
        const res = await fetch('https://rpc.testnet.tempo.xyz', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_call', id: 1,
            params: [{ to: import.meta.env.VITE_TEMPO_PATH_USD || '0x20c0000000000000000000000000000000000000', data }, 'latest'] }),
        })
        const { result } = await res.json()
        if (result && result !== '0x') {
          const raw = BigInt(result)
          const val = Number(raw) / 1e6 // pathUSD testnet uses 6 decimals
          setWalletBalance(val.toLocaleString('en-US', { maximumFractionDigits: 2 }))
        }
      } catch { /* silent */ }
    }
    fetchBalance()
    const interval = setInterval(fetchBalance, 15000)
    return () => clearInterval(interval)
  }, [])

  function handleSetUrl(url) { setApiUrl(url); localStorage.setItem('agent-endpoint', url) }
  function handleNameSet(name) { setParticipantName(name); setShowNameModal(false) }

  // Auto-scroll only when a new message is added — not on state updates within existing messages
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  function setStatus(id, status, listing = null, error = null, pricePaid = null, originalListing = null) {
    setProductState(prev => ({ ...prev, [id]: { status, listing, error, pricePaid, originalListing } }))
  }

  async function handleRetry(product) {
    setStatus(product.id, 'generating')
    const entryId = Date.now()
    logApiCall({ id: entryId, type: 'mpp_flow', name: `Retry: ${product.name}`, steps: [], status: null, source: 'Agent → MPP → Stripe', destination: 'Lambda → Bedrock' })
    try {
      const data = await mppFetch(
        '/generate',
        { method: 'POST', body: JSON.stringify({ description: productToDescription(product), style: product.platform }) },
        { baseUrl: apiUrl, onStep: step => updateApiCall(entryId, c => ({ steps: [...(c.steps || []), step] })) }
      )
      setStatus(product.id, 'done', data.listing, null, data.usage?.pricePaid)
      updateApiCall(entryId, () => ({ status: 200 }))
      broadcastResult({ product, data })
      fetchListings()
    } catch (e) {
      setStatus(product.id, 'error', null, e.message)
      updateApiCall(entryId, () => ({ status: 500 }))
    }
  }

  async function handleRefine(product, feedback) {
    const currentListing = productState[product.id].listing
    if (!currentListing) return

    setStatus(product.id, 'refining', currentListing, null,
      productState[product.id].pricePaid, productState[product.id].originalListing || currentListing)

    const refineEntryId = Date.now()
    logApiCall({ id: refineEntryId, type: 'mpp_flow', name: `Refine: ${product.name}`, steps: [], status: null, source: 'Agent → MPP → Stripe', destination: 'Lambda → Bedrock' })

    try {
      const prompt = `${feedback}\n\nCurrent listing title: ${currentListing.title}\nCurrent description: ${currentListing.description}`
      const data = await mppFetch(
        '/generate',
        { method: 'POST', body: JSON.stringify({ description: prompt, style: product.platform }) },
        { baseUrl: apiUrl, onStep: step => updateApiCall(refineEntryId, c => ({ steps: [...(c.steps || []), step] })) }
      )
      const original = productState[product.id].originalListing || currentListing
      const priceNum = parseFloat((productState[product.id].pricePaid || '0.01').replace(/[^0-9.]/g, '')) || 0.01
      setStatus(product.id, 'done', data.listing, null, productState[product.id].pricePaid, original)
      updateApiCall(refineEntryId, () => ({ status: 200 }))
      setTotalSpent(prev => prev + priceNum)
      broadcastResult({ product: { ...product, name: `${product.name} (refined)` }, data })
    } catch (e) {
      setStatus(product.id, 'refine-error', currentListing, e.message,
        productState[product.id].pricePaid, productState[product.id].originalListing)
      updateApiCall(refineEntryId, () => ({ status: 500 }))
      // Restore done state after showing error briefly
      setTimeout(() => setStatus(product.id, 'done', currentListing, null,
        productState[product.id].pricePaid, productState[product.id].originalListing), 4000)
    }
  }

  async function broadcastResult({ product, data }) {
    if (!resultsUrl) return
    fetch(`${resultsUrl}/results`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resultId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        participantName: localStorage.getItem('agent-custom-name') || localStorage.getItem('samurai-name') || 'Anonymous',
        endpoint: apiUrl, productName: product.name,
        listingTitle: data?.listing?.title || 'Response received',
        platform: product.platform,
        pricePaid: data?.usage?.pricePaid || '$0.01 USDC',
      }),
    }).catch(() => {})
  }

  async function runAgent() {
    if (running) return
    setRunning(true)
    setSummary(null)
    setTotalSpent(0)
    setProductState(Object.fromEntries(ERP_PRODUCTS.map(p => [p.id, { status: 'idle', listing: null, error: null, pricePaid: null, originalListing: null }])))

    // Show instruction as user message
    setMessages([{ type: 'instruction', text: instruction }])

    // Discovery phase — agent searches for and selects an MPP service
    const agentName = localStorage.getItem('agent-custom-name') || localStorage.getItem('samurai-name') || 'Your Agent'
    const knownPrice = localStorage.getItem('agent-detected-price')
    let detectedPrice = knownPrice || null

    const discoverySteps = [
      'Searching for listing generation agents on the MPP network…',
      'Found 3 MPP-compliant agents. Evaluating pricing and capabilities…',
      'Comparing response quality, latency, and cost-per-call…',
      `Selected: ${agentName}${knownPrice ? ` · $${knownPrice} USDC/listing` : ''}`,
    ]

    for (const step of discoverySteps) {
      setMessages(prev => [...prev, { type: 'discovery', text: step, done: false }])
      await new Promise(r => setTimeout(r, 1200))
      setMessages(prev => prev.map((m, i) => i === prev.length - 1 ? { ...m, done: true } : m))
      await new Promise(r => setTimeout(r, 400))
    }

    let successCount = 0

    for (const product of ERP_PRODUCTS) {
      setMessages(prev => [...prev, { type: 'agent', productId: product.id }])
      setStatus(product.id, 'generating')

      const entryId = Date.now()
      logApiCall({ id: entryId, type: 'mpp_flow', name: `Generate: ${product.name}`, steps: [], status: null, source: 'Agent → MPP → Stripe', destination: 'Lambda → Bedrock' })

      try {
        const data = await mppFetch(
          '/generate',
          { method: 'POST', body: JSON.stringify({ description: productToDescription(product), style: product.platform }) },
          {
            baseUrl: apiUrl,
            onStep: step => {
              updateApiCall(entryId, c => ({ steps: [...(c.steps || []), step] }))
              // Capture price from first 402 challenge
              if (!detectedPrice && step.type === '402' && step.detail?.amount) {
                detectedPrice = step.detail.amount
              }
            }
          }
        )

        const pricePaid = data.usage?.pricePaid || detectedPrice || '$0.01 USDC'
        const priceNum = parseFloat(pricePaid.replace(/[^0-9.]/g, '')) || 0.01
        setStatus(product.id, 'done', data.listing, null, pricePaid)
        updateApiCall(entryId, () => ({ status: 200 }))
        setTotalSpent(prev => prev + priceNum)
        successCount++
        broadcastResult({ product, data })
        fetchListings()

      } catch (e) {
        setStatus(product.id, 'error', null, e.message)
        updateApiCall(entryId, () => ({ status: 500 }))
      }
    }

    setSummary({ total: ERP_PRODUCTS.length, success: successCount })
    setRunning(false)
  }

  const doneCount = Object.values(productState).filter(s => s.status === 'done').length

  return (
    <>
      {showNameModal && <NameModal onSet={handleNameSet} defaultName={participantName || ''} />}

      <div className="flex h-full overflow-hidden">

        {/* ── Left panel: queue — controlled by hamburger in Layout ── */}
        <div className="shrink-0 transition-all duration-300 overflow-hidden"
          style={{ width: queueOpen ? '260px' : '0', borderRight: queueOpen ? '1px solid var(--border)' : 'none' }}>
          <QueuePanel productState={productState} apiUrl={apiUrl} onSetApiUrl={handleSetUrl} />
        </div>

        {/* ── Right: chat area ── */}
        <div className="flex-1 flex flex-col min-w-0">

          {/* Top bar: wallet only */}
          {walletAddress && (
            <div className="shrink-0 px-4 py-2 flex items-center gap-2"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>Agent Wallet</span>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {walletAddress.slice(0, 8)}…{walletAddress.slice(-6)}
              </span>
              <span className="text-[11px] px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#059669', fontFamily: 'var(--font-mono)' }}>
                {walletBalance !== null ? `${walletBalance} USDC` : 'testnet · funded'}
              </span>
            </div>
          )}

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                <p className="text-2xl">⚔️</p>
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>SamurAI is ready</p>
                <p className="text-xs max-w-xs leading-relaxed" style={{ color: 'var(--text-faint)' }}>
                  Set an endpoint, edit the instruction if needed, then click Run Agent.
                </p>
              </div>
            )}

            {messages.map((msg, i) => {
              if (msg.type === 'instruction') return <InstructionMessage key={i} text={msg.text} />
              if (msg.type === 'discovery') return <DiscoveryMessage key={i} text={msg.text} done={msg.done} />
              const product = ERP_PRODUCTS.find(p => p.id === msg.productId)
              const state = productState[msg.productId]
              if (!product || !state) return null
              return <AgentMessage key={i} product={product} state={state} onRefine={(feedback) => handleRefine(product, feedback)} onRetry={() => handleRetry(product)} />
            })}

            {summary && !running && (
              <div className="flex items-start gap-3">
                <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold text-white"
                  style={{ background: '#059669' }}>✓</div>
                <div className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm"
                  style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
                  <p style={{ color: 'var(--text)' }}>
                    Done — {summary.success}/{summary.total} listings generated
                  </p>
                </div>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Live feed — above input */}
          {resultsUrl && (
            <div className="px-6 pb-2">
              <LiveFeed resultsUrl={resultsUrl} />
            </div>
          )}

          {/* Bottom input bar */}
          <div className="shrink-0 px-6 py-4" style={{ borderTop: '1px solid var(--border)', background: 'var(--bg)' }}>
            <div className="flex items-end gap-3">
              <textarea
                value={instruction}
                onChange={e => setInstruction(e.target.value)}
                rows={2}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{
                  background: 'var(--bg-subtle)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  fontFamily: 'inherit',
                  lineHeight: '1.5',
                }}
              />
              <button onClick={runAgent} disabled={running}
                className="flex items-center gap-2 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                style={{ background: 'var(--blurple)' }}>
                {running ? <><Spinner size={13} /> Running…</> : '▶ Run Agent'}
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
