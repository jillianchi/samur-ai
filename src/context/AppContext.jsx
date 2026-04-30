import { createContext, useContext, useState, useEffect } from 'react'
import { mppFetch } from '../mpp-client'

const AppContext = createContext()

export function AppProvider({ children }) {
  const [listings, setListings] = useState([])
  const [apiCalls, setApiCalls] = useState([])
  const [queueOpen, setQueueOpen] = useState(true)

  async function fetchListings() {
    try {
      const data = await mppFetch('/listings')
      const mapped = (data.listings || [])
        .sort((a, b) => b.createdAt?.localeCompare(a.createdAt))
        .map(item => ({
          id: item.listingId,
          date: item.createdAt?.slice(0, 10) ?? '',
          platform: item.platform,
          ...item.listing,
        }))
      setListings(mapped)
    } catch (e) {
      console.error('Listings fetch failed:', e)
    }
  }

  useEffect(() => { fetchListings() }, [])

  function logApiCall(call) {
    const now = new Date()
    setApiCalls(prev => [{
      ...call,
      id: call.id ?? Date.now(),
      time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    }, ...prev])
  }

  function clearApiCalls() {
    setApiCalls([])
  }

  function updateApiCall(id, updater) {
    setApiCalls(prev => prev.map(c => c.id === id ? { ...c, ...updater(c) } : c))
  }

  function startNewListing() {
    // resets the queue panel status — no-op for now
  }

  return (
    <AppContext.Provider value={{
      fetchListings,
      listings,
      apiCalls,
      logApiCall,
      updateApiCall,
      clearApiCalls,
      startNewListing,
      queueOpen,
      setQueueOpen,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
