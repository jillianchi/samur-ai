import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { JsonHighlighter } from './JsonHighlighter'

// Exact colours from demoeng-acp light mode
// bg-background        → #ffffff  (toolbar, JSON blocks)
// bg-background-accent → #f5f4f2  (panel body)
// borders              → rgba(0,0,0,0.08)

function CopyButton({ data }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(JSON.stringify(data, null, 2)); setCopied(true); setTimeout(() => setCopied(false), 1500) }}
      className="p-1 rounded transition-colors text-black/25 hover:text-black/50"
    >
      {copied
        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
      }
    </button>
  )
}

// Exact badge from demoeng-acp — light green/red pill
function HttpBadge({ status }) {
  if (!status) return null
  const ok = status < 400
  return (
    <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
      ok ? 'text-green-700 bg-green-100/80' : 'text-red-700 bg-red-100/80'
    }`}>
      {status}
    </span>
  )
}

// Secondary label badge (WEBHOOK, INTERNAL, MPP, RPC)
function TagBadge({ label, color = 'default' }) {
  const styles = {
    default:  'bg-black/8 text-black/50',
    purple:   'bg-purple-100 text-purple-700',
    blurple:  'text-[#635bff] bg-[rgba(99,91,255,0.1)]',
    gray:     'bg-black/5 text-black/40',
  }
  return (
    <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded tracking-wide ${styles[color]}`}>
      {label}
    </span>
  )
}

function JsonBlock({ label, data }) {
  if (data === undefined) return null
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold text-black/30 uppercase tracking-widest">{label}</span>
        <CopyButton data={data} />
      </div>
      <div className="rounded-lg p-3 overflow-auto max-h-52 bg-white border border-black/8">
        <JsonHighlighter data={data} light />
      </div>
    </div>
  )
}

// ── A single row — matches demoeng-acp AccordionItem exactly ─────────────────

function Row({ id, status, method, action, source, destination, time, tag, tagColor, request, response, open, onToggle, indent = false }) {
  const hasDetail = request !== undefined || response !== undefined
  return (
    <div className={indent ? 'border-b border-black/5' : 'border-b border-black/8'}>
      {/* Trigger row */}
      <button
        onClick={hasDetail ? onToggle : undefined}
        className={`w-full text-left transition-colors ${hasDetail ? 'hover:bg-black/[0.02] cursor-pointer' : 'cursor-default'} ${indent ? 'px-4 py-2' : 'p-2.5'}`}
      >
        <div className="flex items-center gap-2 font-mono text-sm">
          {/* Status badge */}
          <span className="w-14 shrink-0 flex justify-center">
            {status ? <HttpBadge status={status} /> : <span className="w-14" />}
          </span>

          {/* Method or tag */}
          <span className="w-14 shrink-0 flex items-center justify-center">
            {tag
              ? <TagBadge label={tag} color={tagColor} />
              : <span className="text-xs font-semibold uppercase text-black/40">{method}</span>
            }
          </span>

          {/* Action */}
          <span className="grow text-sm font-medium text-black/80 leading-snug">{action}</span>

          {/* Timestamp */}
          <span className="shrink-0 text-xs text-black/30">{time}</span>

          {/* Chevron */}
          {hasDetail && (
            <svg className={`w-3.5 h-3.5 shrink-0 text-black/25 transition-transform ${open ? '' : '-rotate-90'}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          )}
        </div>

        {/* Second row: source → destination */}
        {(source || destination) && (
          <div className="flex items-center gap-1 mt-1 pl-[7rem]">
            <span className="text-xs text-black/35">{source}</span>
            {destination && <><span className="text-black/20 text-xs">→</span><span className="text-xs text-black/35">{destination}</span></>}
          </div>
        )}
      </button>

      {/* Expanded detail — matches demoeng RequestDetails */}
      {open && (request !== undefined || response !== undefined) && (
        <div className="px-4 pb-3 space-y-3" style={{ background: '#f9f8f6' }}>
          {(source || destination) && (
            <div className="grid grid-cols-3 gap-3 text-xs pt-2">
              {[['Source', source], ['Destination', destination], ['Time', time]].map(([l, v]) => v ? (
                <div key={l}>
                  <p className="font-semibold text-black/30 mb-1 uppercase tracking-widest">{l}</p>
                  <p className="font-mono text-black/60">{v}</p>
                </div>
              ) : null)}
            </div>
          )}
          <JsonBlock label="Request" data={request} />
          <JsonBlock label="Response" data={response} />
        </div>
      )}
    </div>
  )
}

// ── MPP flow: render as flat rows grouped under a subtle section label ────────

function MppGroup({ call, openId, setOpenId }) {
  const steps = call.steps || []

  // Map MPP step type → row props
  const stepToRow = (step) => {
    switch (step.type) {
      case 'request': return { status: null, method: 'POST', tag: null, action: step.label, source: 'Agent', destination: 'Lambda', request: step.detail }
      case '402':     return { status: 402,  method: null,  tag: null, action: step.label, source: 'Lambda', destination: 'Agent', response: step.detail }
      case 'rpc':     return { status: null, method: null,  tag: 'RPC', tagColor: 'purple', action: step.label, source: 'Agent', destination: 'Tempo', request: step.detail }
      case 'retry':   return { status: null, method: 'POST', tag: null, action: step.label, source: 'Agent', destination: 'Lambda', request: step.detail }
      case '200':     return { status: 200,  method: null,  tag: null, action: step.label, source: 'Lambda', destination: 'Agent', response: step.detail }
      default:        return { status: null, method: '—', action: step.label }
    }
  }

  return (
    <div className="border-b border-black/8">
      {/* Group header — subtle, like a section label */}
      <div className="flex items-center gap-2 px-2.5 py-2 bg-[#f0eeeb] border-b border-black/5">
        <TagBadge label="MPP" color="blurple" />
        <span className="text-xs font-medium text-black/60 truncate grow">{call.name}</span>
        {call.status && <HttpBadge status={call.status} />}
        <span className="text-xs text-black/30 shrink-0">{call.time}</span>
      </div>

      {/* Flat step rows */}
      {steps.length === 0
        ? <p className="text-xs italic text-black/30 px-4 py-2">Waiting…</p>
        : [...steps].reverse().map((step, i) => {
            // reversed index: i=0 is the LATEST step (200 OK), i=last is the first step (POST)
            const originalIndex = steps.length - 1 - i
            const rowId = `${call.id}-${originalIndex}`
            const props = stepToRow(step)
            return (
              <Row
                key={rowId}
                id={rowId}
                {...props}
                time={call.time}
                open={openId === rowId}
                onToggle={() => setOpenId(openId === rowId ? null : rowId)}
                indent
              />
            )
          })
      }
    </div>
  )
}

// ── Panel ─────────────────────────────────────────────────────────────────────

const TABS = ['All', 'Webhooks', 'Errors']

export default function DebugPanel({ onClose }) {
  const { apiCalls, clearApiCalls } = useApp()
  const [tab, setTab] = useState('All')
  const [openId, setOpenId] = useState(null)

  const filtered = tab === 'All' ? apiCalls
    : tab === 'Webhooks' ? apiCalls.filter(c => c.isWebhook)
    : apiCalls.filter(c => (c.status ?? 0) >= 400)

  // Auto-open the latest entry's first step (like demoeng item-0)
  useEffect(() => {
    if (filtered.length > 0) {
      const latest = filtered[0]
      if (latest.type === 'mpp_flow' && latest.steps?.length) {
        // auto-open the LAST step (200 OK) — it's rendered first since we reverse
        setOpenId(`${latest.id}-${latest.steps.length - 1}`)
      } else {
        setOpenId(String(latest.id))
      }
    }
  }, [filtered.length, filtered[0]?.steps?.length])

  return (
    <div className="h-full flex flex-col" style={{ background: '#f5f4f2', fontFamily: 'var(--font-sans)' }}>

      {/* Toolbar — white bg exactly like demoeng */}
      <div className="flex items-center justify-between px-3 py-2 shrink-0 bg-white border-b border-black/8">
        <div className="flex items-center gap-0.5">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className="text-xs px-2.5 py-1 rounded transition-colors font-medium"
              style={{ background: tab === t ? 'rgba(0,0,0,0.07)' : 'transparent', color: tab === t ? '#0a0a0a' : 'rgba(0,0,0,0.45)' }}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {apiCalls.length > 0 && (
            <button onClick={() => { clearApiCalls(); setOpenId(null) }} title="Clear" className="p-1.5 rounded transition-colors text-black/40 hover:text-black/60">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6M9 6V4h6v2"/>
              </svg>
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded transition-colors text-black/40 hover:text-black/60">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-6">
            <p className="text-[12px] text-black/40">No API calls yet</p>
            <p className="text-xs text-black/25 leading-relaxed">Run the agent to see the MPP payment flow here.</p>
          </div>
        ) : (
          filtered.map(call =>
            call.type === 'mpp_flow'
              ? <MppGroup key={call.id} call={call} openId={openId} setOpenId={setOpenId} />
              : <Row
                  key={call.id}
                  id={String(call.id)}
                  status={call.status}
                  method={call.method}
                  action={call.name}
                  source={call.source}
                  destination={call.destination}
                  time={call.time}
                  request={call.request}
                  response={call.response}
                  open={openId === String(call.id)}
                  onToggle={() => setOpenId(openId === String(call.id) ? null : String(call.id))}
                />
          )
        )}
      </div>
    </div>
  )
}
