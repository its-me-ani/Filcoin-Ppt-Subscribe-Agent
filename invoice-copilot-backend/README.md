# invoice-copilot-backend

Agent runtime + storage router + payment router + on-chain anchor for the
Agentic Invoice Co-Pilot.

## Run

```bash
cp .env.example .env
npm install
npm run dev
```

Boots on `:8787`. With no env vars set, runs in fully-mocked mode (deterministic
agent plan, local hash "CIDs", mock payment receipts) so the full flow works
without any keys.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Status + which providers are wired |
| POST | `/api/agent/chat` | `{message, sessionId?}` → runs the agent loop |
| GET | `/api/agent/session/:id` | Fetch current session state |
| POST | `/api/invoices/generate` | Generate a draft invoice from prompt or partial |
| POST | `/api/invoices/validate` | Validate an invoice |
| POST | `/api/invoices/store` | Upload to IPFS/Filecoin |
| POST | `/api/invoices/anchor` | Anchor `(cid, hash)` on-chain |
| GET | `/api/invoices/ipfs/:cid` | Proxy-fetch from IPFS |
| POST | `/api/payments/quote` | Quote for a rail |
| POST | `/api/payments/execute` | Execute via x402 / mpp / erc8004 |

## Environment

See `.env.example`. Key knobs:

- `AI_PROVIDER`: `mock` (default), `openai`, `anthropic`, `ollama`
- `STORAGE_PRIMARY`: `pinata` (default), `lighthouse`
- `INVOICE_REGISTRY_ADDRESS`: set after deploying `invoice-copilot-contracts`

## Architecture

```
src/
├── server.ts              Express bootstrap
├── agent/
│   ├── runtime.ts         Tool-calling loop
│   ├── llm.ts             Provider abstraction (openai/anthropic/ollama/mock)
│   └── tools/             6 tools: generate, validate, store, anchor, pay, export
├── storage/
│   ├── router.ts          Picks Lighthouse vs Pinata (or local fallback)
│   ├── lighthouse.ts
│   └── pinata.ts
├── payments/
│   ├── router.ts          Dispatch by rail
│   └── adapters/          x402, mpp-tempo, erc8004
├── chain/
│   └── registry.ts        ethers v6 calls to InvoiceRegistry
└── routes/                REST routes thin wrappers over the above
```
