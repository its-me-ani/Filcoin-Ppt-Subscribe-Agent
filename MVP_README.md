# Agentic Invoice Co-Pilot — Full-Stack MVP

Cross-platform (PWA + iOS + Android + Electron) Web3 invoicing app with an
agentic Co-Pilot that drafts, validates, stores on IPFS/Filecoin, anchors
on-chain, and settles invoices using **x402**, **MPP (Tempo)**, and
**ERC-8004** payment rails.

This MVP spans three packages:

| Package | Role |
|---|---|
| [filcoin-agent-mpp-x422/](filcoin-agent-mpp-x422/) | Ionic/React + Capacitor app (existing) + Co-Pilot UI (new) |
| [invoice-copilot-backend/](invoice-copilot-backend/) | Node/Express agent runtime, storage router, payment router, chain anchor |
| [invoice-copilot-contracts/](invoice-copilot-contracts/) | `InvoiceRegistry.sol` + `Erc8004AgentPayments.sol` (Hardhat) |

---

## Quickstart (5 minutes, no keys needed)

The MVP has a **mock mode** that exercises the full agent pipeline without any
API keys — perfect for the first local run or a demo laptop with no network.

### 1. Backend

```bash
cd invoice-copilot-backend
cp .env.example .env
npm install
npm run dev
```

Expected output:

```
✓ Invoice Co-Pilot backend listening on :8787
  provider=mock  storage=pinata  chain=11155420
  on-chain anchoring: mock
```

### 2. Frontend

```bash
cd filcoin-agent-mpp-x422
# one-time: add VITE_COPILOT_BACKEND_URL to .env
echo 'VITE_COPILOT_BACKEND_URL=http://localhost:8787' >> .env
npm install        # already installed if you've run the app before
npm run dev
```

Open the app, go to **Dashboard**, click the **✨ Co-Pilot** button in the
header.

### 3. Demo prompt

Paste any of these into the Co-Pilot panel:

- `Bill NSUT ₹45,000 for March cloud hosting, milestone payment`
- `Invoice Dept. of Education for 12 training hours at $80/hr, x402`
- `Issue ₹1,20,000 to AIC for Q1 consulting, agent-auto-pay in USDC`

You should see the agent call each tool in order and the status chips
populate: **Stored → Anchored → Paid**.

---

## Enabling real services

### Real LLM
Set in `invoice-copilot-backend/.env`:

```bash
AI_PROVIDER=anthropic       # or openai | ollama
AI_MODEL=claude-sonnet-4-6
AI_API_KEY=sk-ant-...
```

### Real Filecoin / IPFS
```bash
STORAGE_PRIMARY=lighthouse
LIGHTHOUSE_API_KEY=...
# or
STORAGE_PRIMARY=pinata
PINATA_JWT=eyJhbGci...
```

### Real on-chain anchoring (Optimism Sepolia)

```bash
cd invoice-copilot-contracts
cp .env.example .env
# fill DEPLOYER_PRIVATE_KEY
npm install
npx hardhat compile
npm run deploy:optimism-sepolia
```

Copy the printed `INVOICE_REGISTRY_ADDRESS` into both:
- `invoice-copilot-backend/.env` → `INVOICE_REGISTRY_ADDRESS=0x…`
- `invoice-copilot-backend/.env` → `BACKEND_SIGNER_PRIVATE_KEY=0x…` (same
  signer as the deployer, or any funded address on OP Sepolia)

Restart the backend. It will log:

```
on-chain anchoring: enabled
```

### Real payment rails
Configure as available — adapters already gracefully fall back to mock receipts
so the agent flow never breaks mid-demo.

```bash
X402_GATEWAY_URL=https://...
MPP_TEMPO_ENDPOINT=https://...
ERC8004_AGENT_ADDRESS=0x...
```

---

## Architecture

See [filcoin-agent-mpp-x422/PROTOTYPE_ARCHITECTURE.md](filcoin-agent-mpp-x422/PROTOTYPE_ARCHITECTURE.md)
for the full design doc (layer-by-layer breakdown, data flow, file map).

Short version:

```
User prompt ─► CoPilotPanel (Ionic) ─► /api/agent/chat ─► Agent Runtime
                                                            │
                     ┌──────────────────────┬───────────────┼───────────────┐
                     ▼                      ▼               ▼               ▼
              generate_invoice       validate_invoice  store_on_ipfs  anchor_on_chain
                                                                │               │
                                                                ▼               ▼
                                                         StorageRouter   InvoiceRegistry.sol
                                                         (Lighthouse /     (Optimism Sepolia)
                                                          Pinata)
                                                                                │
                                                                                ▼
                                                                         request_payment
                                                                                │
                                                            ┌───────────────────┼───────────────────┐
                                                            ▼                   ▼                   ▼
                                                        x402                 MPP (Tempo)        ERC-8004
```

---

## What you get in the MVP

- [x] **Agentic Co-Pilot** that drafts invoices from natural language,
      validates fields, detects anomalies, suggests corrections.
- [x] **Mock + real LLM providers** (Anthropic, OpenAI, Ollama, deterministic mock).
- [x] **IPFS/Filecoin storage** via Pinata or Lighthouse (auto-fallback to local hash).
- [x] **InvoiceRegistry** smart contract: `anchor`, `markPaid`, `dispute`,
      `resolve`; event streams for live status on the dashboard.
- [x] **Three payment adapters**: x402 HTTP-402, MPP Tempo (milestones /
      streaming / multi-party), ERC-8004 (agent-initiated settlement).
- [x] **Graceful degradation**: if any downstream service is unavailable, the
      agent still completes the flow with deterministic mock data — demos never
      fully fail on stage.
- [x] **Cross-platform**: app is Ionic + Capacitor, already deployable to
      PWA / iOS / Android / Electron via the existing scripts.
- [x] **Modular APIs**: every tool, adapter, and provider has a clean TS
      interface — ready to publish on agentic marketplaces.

## Not yet in the MVP
- Dispute flow UI (contract supports it, UI postponed)
- Multi-tenant access control on the registry (`markPaid` is open)
- Fiat on-ramp
- Starknet / ZK proof integration
- Push notifications on payment events

---

## Repository map

```
filcoin/
├── MVP_README.md                           ← you are here
├── filcoin-agent-mpp-x422/                 Ionic/React + Capacitor app
│   ├── PROTOTYPE_ARCHITECTURE.md           full architecture design doc
│   ├── src/
│   │   ├── components/copilot/             NEW — CoPilotPanel, launcher
│   │   ├── services/agent/copilot-client   NEW — backend client
│   │   └── … (existing pages, contexts, services)
│   └── .env.copilot.example                NEW — frontend env template
│
├── invoice-copilot-backend/                NEW — Node/Express agent runtime
│   ├── src/
│   │   ├── server.ts
│   │   ├── agent/ (runtime, llm, tools)
│   │   ├── storage/ (router, pinata, lighthouse)
│   │   ├── payments/ (router, x402, mpp-tempo, erc8004)
│   │   ├── chain/ (registry.ts)
│   │   └── routes/ (agent, invoices, payments)
│   └── .env.example
│
└── invoice-copilot-contracts/              NEW — Hardhat project
    ├── contracts/
    │   ├── InvoiceRegistry.sol
    │   └── Erc8004AgentPayments.sol
    ├── scripts/deploy.ts
    └── hardhat.config.ts
```

---

## Troubleshooting

**Co-Pilot says “Co-Pilot backend unreachable”**
→ Make sure `npm run dev` is running in `invoice-copilot-backend`, and that
`VITE_COPILOT_BACKEND_URL` in `filcoin-agent-mpp-x422/.env` matches the
backend port (default `8787`).

**Backend says “on-chain anchoring: mock”**
→ That's expected when `INVOICE_REGISTRY_ADDRESS` or
`BACKEND_SIGNER_PRIVATE_KEY` is unset. Follow the deploy steps above, then
restart the backend.

**`npm install` fails in `invoice-copilot-contracts`**
→ Hardhat is optional for the prototype. You only need it if you want to
actually deploy the contract. For a local demo the backend's mock anchor
is fine.
