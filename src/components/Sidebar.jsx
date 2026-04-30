import { useState } from 'react'
import { useApp } from '../context/AppContext'

function ListingItem({ listing }) {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full text-left px-3 py-2 rounded-lg transition-colors"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-subtle)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div className="flex items-start justify-between gap-1">
          <p className="text-xs font-medium leading-snug" style={{ color: 'var(--text)' }}>
            {listing.title}
          </p>
          <svg className={`w-3 h-3 shrink-0 mt-0.5 transition-transform ${open ? '' : '-rotate-90'}`}
            style={{ color: 'var(--text-faint)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
        <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-faint)' }}>
          {listing.date}{listing.platform ? ` · ${listing.platform}` : ''}
        </p>
      </button>

      {open && (
        <div className="mx-2 mb-2 px-3 py-2.5 rounded-lg text-[11px] space-y-2"
          style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border)' }}>
          {listing.description && (
            <p className="leading-relaxed line-clamp-3" style={{ color: 'var(--text-muted)' }}>
              {listing.description}
            </p>
          )}
          {listing.features?.length > 0 && (
            <ul className="space-y-1">
              {listing.features.slice(0, 3).map((f, i) => (
                <li key={i} className="flex items-start gap-1.5" style={{ color: 'var(--text-faint)' }}>
                  <span style={{ color: 'var(--blurple)', opacity: 0.6 }}>◆</span>
                  <span className="line-clamp-1">{f}</span>
                </li>
              ))}
            </ul>
          )}
          {listing.priceRange && (
            <p className="font-medium" style={{ color: 'var(--text-muted)' }}>{listing.priceRange}</p>
          )}
        </div>
      )}
    </div>
  )
}

export default function Sidebar({ onClose, pinned, onTogglePin }) {
  const { listings, startNewListing } = useApp()

  return (
    <div className="h-full w-60 flex flex-col select-none" style={{ background: 'var(--bg)', borderRight: '1px solid var(--border)' }}>

      {/* New listing + pin */}
      <div className="p-3 pt-4 flex items-center gap-2" style={{ borderBottom: '1px solid var(--border)' }}>
        <button
          onClick={() => { startNewListing(); onClose() }}
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ border: '1px solid var(--border)', color: 'var(--text)', background: 'var(--bg-subtle)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          New listing
        </button>

        <button
          onClick={onTogglePin}
          title={pinned ? 'Unpin sidebar' : 'Pin sidebar open'}
          className="p-2 rounded-lg transition-colors"
          style={{
            background: pinned ? 'var(--blurple-light)' : 'transparent',
            color: pinned ? 'var(--blurple)' : 'var(--text-faint)',
            border: '1px solid var(--border)',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
            <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5v6h2v-6h5v-2l-2-2z" />
          </svg>
        </button>
      </div>

      {/* Listings */}
      <div className="flex-1 overflow-y-auto px-2 py-2">
        {listings.length > 0 && (
          <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-faint)' }}>
            My Listings
          </p>
        )}
        {listings.length === 0 && (
          <p className="px-3 pt-3 text-xs leading-relaxed" style={{ color: 'var(--text-faint)' }}>
            Your generated listings will appear here.
          </p>
        )}
        {listings.map(listing => (
          <ListingItem key={listing.id} listing={listing} />
        ))}
      </div>

      {/* Bottom */}
      <div className="p-3 text-[11px]" style={{ borderTop: '1px solid var(--border)', color: 'var(--text-faint)' }}>
        $0.01 USDC per listing · Stripe MPP
      </div>
    </div>
  )
}
