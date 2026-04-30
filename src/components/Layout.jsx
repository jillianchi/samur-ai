import { useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import DebugPanel from './DebugPanel'

export default function Layout() {
  const [debugOpen, setDebugOpen] = useState(false)
  const { apiCalls, queueOpen, setQueueOpen } = useApp()

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg)', color: 'var(--text)' }}>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="shrink-0 flex items-center gap-2 px-3 h-11"
          style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>

          {/* Hamburger — toggles the ERP queue panel */}
          <button
            onClick={() => setQueueOpen(v => !v)}
            className="p-1.5 rounded-md transition-colors"
            style={{ color: queueOpen ? 'var(--blurple)' : 'var(--text-muted)' }}
            aria-label="Toggle queue"
            title="Toggle product queue"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <Link to="/"
            className="text-[13px] font-semibold tracking-tight transition-colors"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text)', letterSpacing: '-0.01em' }}>
            SamurAI
          </Link>

          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setDebugOpen(v => !v)}
              title="API calls"
              className="relative p-1.5 rounded-md transition-colors"
              style={{
                background: debugOpen ? 'var(--blurple)' : 'transparent',
                color: debugOpen ? '#fff' : 'var(--text-muted)',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
              </svg>
              {apiCalls.length > 0 && !debugOpen && (
                <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full" style={{ background: 'var(--blurple)' }} />
              )}
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-hidden">
          <Outlet />
        </div>
      </div>

      {/* Debug panel */}
      <div
        className="shrink-0 transition-all duration-300 overflow-hidden"
        style={{ width: debugOpen ? '420px' : '0', borderLeft: '1px solid var(--border)' }}
      >
        <DebugPanel onClose={() => setDebugOpen(false)} />
      </div>
    </div>
  )
}
