import { Mppx, tempo } from 'mppx/client'
import { privateKeyToAccount } from 'viem/accounts'

const privateKey = import.meta.env.VITE_AGENT_PRIVATE_KEY

// Export wallet info for UI display
export const walletAddress = privateKey ? privateKeyToAccount(privateKey).address : null

// Capture the native fetch BEFORE mppx or anything else can replace it
const nativeFetch = globalThis.fetch.bind(globalThis)

function getAuthHeader(headers) {
  if (!headers) return ''
  if (headers instanceof Headers) return headers.get('authorization') || headers.get('Authorization') || ''
  return headers['Authorization'] || headers['authorization'] || ''
}

function parseChallenge(wwwAuth) {
  const match = wwwAuth?.match(/request="([^"]+)"/)
  if (!match) return null
  try { return JSON.parse(atob(match[1])) } catch { return null }
}

function getUserId() {
  // Use participant name if set, else fallback to persistent UUID
  const name = localStorage.getItem('samurai-name')
  if (name) return name
  let id = localStorage.getItem('listingbot_user_id')
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('listingbot_user_id', id) }
  return id
}

export async function mppFetch(path, options = {}, { onStep, baseUrl } = {}) {
  const BASE_URL = baseUrl || import.meta.env.VITE_API_URL || ''
  const url = `${BASE_URL}${path}`
  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': getUserId(),
    ...(options.headers || {}),
  }

  if (!privateKey) {
    const res = await fetch(url, { ...options, headers })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
    return data
  }

  const account = privateKeyToAccount(privateKey)
  let parsedBody = null
  try { parsedBody = JSON.parse(options.body) } catch { /* ignore */ }

  // Build observable fetch — mppx will use this for ALL its network calls
  const observableFetch = async (input, init = {}) => {
    const fetchUrl = String(input?.url ?? input ?? '')
    const isRpc = fetchUrl.includes('tempo') || fetchUrl.includes('moderato') || fetchUrl.includes('rpc.')
    const auth = getAuthHeader(init?.headers)
    const hasAuth = auth.startsWith('Payment')

    if (onStep) {
      if (isRpc) {
        onStep({
          type: 'rpc',
          label: '→ USDC transfer on Tempo blockchain',
          detail: {
            from: account.address.slice(0, 18) + '...',
            amount: '0.01 USDC',
            network: 'Tempo testnet (chain 42431)',
          },
        })
      } else if (!hasAuth) {
        onStep({ type: 'request', label: `POST ${path}`, detail: parsedBody })
      } else {
        // Retry: body is the same as the original request (description + style).
        // Authorization is a REQUEST HEADER, not body — show it separately.
        const token = auth.replace('Payment ', '')
        onStep({
          type: 'retry',
          label: `POST ${path}`,
          detail: {
            body: parsedBody,
            'Authorization header': `Payment ${token.slice(0, 60)}…  [${token.length} chars — MPP payment credential]`,
          },
        })
      }
    }

    const response = await nativeFetch(input, init)

    if (onStep && !isRpc) {
      if (response.status === 402) {
        const piId = response.headers.get('x-payment-intent-id') || response.headers.get('X-Payment-Intent-Id')
        const wwwAuth = response.headers.get('www-authenticate') || response.headers.get('WWW-Authenticate') || ''
        const challenge = parseChallenge(wwwAuth)
        onStep({
          type: '402',
          label: '402 Payment Required',
          detail: {
            'Stripe PaymentIntent': piId ?? '(see Lambda logs)',
            'deposit address': challenge?.recipient ?? '—',
            amount: '0.01 USDC',
            chain: `Tempo testnet (${challenge?.methodDetails?.chainId ?? 42431})`,
          },
        })
      } else if (response.ok && hasAuth) {
        const cloned = response.clone()
        cloned.json().then(data => {
          // ListingBot-specific fields if available, else raw response
          const detail = data?.listingId
            ? { listingId: data.listingId, title: data.listing?.title, inputTokens: data.usage?.inputTokens, outputTokens: data.usage?.outputTokens, pricePaid: data.usage?.pricePaid }
            : data
          onStep({ type: '200', label: '200 OK', detail })
        }).catch(() => onStep({ type: '200', label: '200 OK', detail: null }))
      }
    }

    return response
  }

  // Create client with custom fetch + onChallenge hook
  const client = Mppx.create({
    methods: [tempo({ account, testnet: true })],
    polyfill: false,       // don't touch globalThis.fetch
    fetch: observableFetch, // our observable version
    onChallenge: async (challenge, { createCredential }) => {
      // 402 step is already logged in observableFetch — just sign and pay
      return createCredential()
    },
  })

  const res = await client.fetch(url, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`)
  return data
}
