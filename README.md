# SamurAI — Universal MPP Agent

A browser-based AI agent that autonomously calls MPP-enabled services and pays for them in USDC. Built for the AI Engineer Conference Singapore workshop to demonstrate machine-to-machine payments with no human in the payment loop.

Machine Payments Protocol: https://mpp.dev/

## What it does

SamurAI is a simulated agent that takes a list of products feed, discovers a participant's ListingBot endpoint via `openapi.json`, and generates listings for each product — paying automatically in USDC via the Tempo blockchain for every call.

<img width="1509" height="905" alt="image" src="https://github.com/user-attachments/assets/3d6aabe8-9354-476e-9b16-6d7116d1fe65" />


The agent comes with a crypto wallet which can be spent with any services following the MPP protocol. Debug panel display MPP flow.
<br>

<br>
<img width="1512" height="907" alt="image" src="https://github.com/user-attachments/assets/d12c21f8-18f2-4f8b-a24a-e0b1d34f6805" />

To set up, developers will only need to input their endpoint under "Simulation". A collapsible live feed is available to view all USDC spent. 


<br>
Activities of the wallet can be found here: 
https://explore.testnet.tempo.xyz/address/0x216d40b5b13d9E28216A3282DF4AFb1d2370DCeF


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

SamurAI is the facilitator's agent - to be hosted publicly. Workshop participants build and deploy their own [ListingBot](https://github.com/jillianchi/ai-engineer-mpp) endpoint — SamurAI then discovers and calls each participant's endpoint, paying in USDC per listing.
