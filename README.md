# SamurAI — Universal MPP Agent

A browser-based AI agent that autonomously calls MPP-enabled services and pays for them in USDC. Built for the AI Engineer Conference Singapore workshop to demonstrate machine-to-machine payments with no human in the payment loop.

## What it does

SamurAI takes a list of products, discovers a participant's ListingBot endpoint via `openapi.json`, and generates listings for each product — paying automatically in USDC via the Tempo blockchain for every call.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React · Vite |
| Payment SDK | mppx/client |
| Wallet | viem/accounts · Tempo testnet |
| Blockchain | Tempo testnet · USDC |
| Live Feed | Polls `/results` every 3s |

## Key Features

- **Auto-payment** — handles the full MPP 402→pay→retry cycle via `mppx/client`
- **Endpoint discovery** — fetches `openapi.json` from any MPP service to detect agent name and price
- **Live results feed** — all participants see each other's results in real time
- **Debug panel** — shows every MPP step: request, 402 challenge, on-chain tx, credential, 200 receipt
- **Refinement** — agent can refine individual listings on request
- **Pre-funded testnet wallet** — workshop participants use a shared test wallet

## Run Locally

```bash
npm install
cp .env.example .env   # fill in values
npm run dev
```

### Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | ListingBot endpoint (e.g. `https://xxx.execute-api.us-east-1.amazonaws.com`) |
| `VITE_AGENT_PRIVATE_KEY` | Tempo testnet wallet private key — test only, never use a real wallet |
| `VITE_RESULTS_URL` | Shared results endpoint for live feed |

## Payment Flow

SamurAI uses `mppx/client` to handle payments transparently:

```
client.fetch(url, body)
  → POST /generate (no auth)
  → 402 received → onChallenge fires → createCredential()
      → eth_sendRawTransaction → 0.015 USDC on Tempo testnet
          → POST /generate (Authorization: Payment <credential>)
              → 200 OK + Payment-Receipt
```

The agent wallet signs all transactions using `viem/accounts` with `VITE_AGENT_PRIVATE_KEY`.

## Workshop Context

SamurAI is the facilitator's agent. Workshop participants build and deploy their own [ListingBot](https://github.com/jillianchi/ai-engineer-mpp) endpoint — SamurAI then discovers and calls each participant's endpoint, paying in USDC per listing.
