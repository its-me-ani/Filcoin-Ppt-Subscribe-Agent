# Agentic Web3 Invoice Co-Pilot — Prototype Architecture

**Scope:** Basic, demo-ready prototype that layers an agentic Co-Pilot and Web3
(payments + decentralized storage + new on-chain registry contract) on top of
the existing `filcoin-agent-mpp-x422` Ionic/React + Capacitor invoice app.

**Goal for the prototype:** demonstrate the end-to-end happy path:
`prompt → generate → validate → store (IPFS/Filecoin) → anchor on-chain → pay (x402 / MPP / ERC-8004) → export`.

---

## 1. Design Principles

1. **Re-use the existing app shell.** Don't rebuild the Ionic/React UI,
   `InvoiceContext`, SQLite layer, or Pinata IPFS service — wrap them.
2. **One new smart contract** (`InvoiceRegistry.sol`) as the single on-chain
   anchor. Payments are handled by existing standards (x402 / MPP / ERC-8004)
   via adapters, not by custom contracts.
3. **Agent is a thin orchestrator.** The AI Co-Pilot is a tool-calling agent
   that drives existing services — it does **not** own state.
4. **Chain-agnostic via adapter pattern.** Optimism is the default L2 for the
   prototype; the `PaymentRouter` service lets us swap chains without touching
   the UI.
5. **Degrade gracefully.** If IPFS/chain/agent is unavailable, the invoice
   still saves locally (SQLite) so the app never fully breaks during a demo.

---

## 2. High-Level System Diagram

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                         CROSS-PLATFORM CLIENT (Ionic + Capacitor)             │
│           PWA  •  iOS (Capacitor)  •  Android (Capacitor)  •  Electron        │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌───────────────┐  ┌──────────────────┐  ┌──────────────────┐               │
│  │ DashboardHome │  │   InvoicePage    │  │  CoPilotPanel    │  ◄── NEW      │
│  │  (existing)   │  │    (existing)    │  │  (chat + actions)│               │
│  └───────┬───────┘  └────────┬─────────┘  └────────┬─────────┘               │
│          │                   │                     │                          │
│          ▼                   ▼                     ▼                          │
│  ┌──────────────────────────────────────────────────────────────┐             │
│  │                InvoiceContext + WalletContext                │             │
│  │                (existing + extended with agent session)      │             │
│  └──────┬───────────────┬──────────────────┬───────────────┬────┘             │
│         │               │                  │               │                  │
│         ▼               ▼                  ▼               ▼                  │
│  ┌────────────┐  ┌─────────────┐   ┌──────────────┐  ┌──────────────┐         │
│  │  Agent     │  │   Storage   │   │   Payment    │  │   Export     │         │
│  │  Runtime   │  │   Router    │   │   Router     │  │   Service    │         │
│  │  (NEW)     │  │   (NEW)     │   │   (NEW)      │  │  (existing)  │         │
│  └─────┬──────┘  └──────┬──────┘   └──────┬───────┘  └──────────────┘         │
│        │                │                 │                                   │
└────────┼────────────────┼─────────────────┼───────────────────────────────────┘
         │                │                 │
         ▼                ▼                 ▼
┌────────────────┐  ┌─────────────┐  ┌─────────────────────────────────────────┐
│ LLM Provider   │  │ IPFS/Fil    │  │        Blockchain Layer (L2)            │
│ (OpenAI /      │  │ (Pinata,    │  │                                         │
│  Anthropic /   │  │  Lighthouse,│  │  ┌───────────────────────────────────┐  │
│  local)        │  │  Storacha)  │  │  │   InvoiceRegistry.sol  (NEW)      │  │
│                │  │             │  │  │   • anchor(cid, hash, metadata)   │  │
│  Tool-calling  │  │  Returns    │  │  │   • markPaid(invoiceId, txRef)    │  │
│  agent         │  │  CID        │  │  │   • dispute / resolve (stub)      │  │
└────────────────┘  └─────────────┘  │  └───────────────────────────────────┘  │
                                     │                                         │
                                     │  x402 gateway  •  MPP (Tempo) router    │
                                     │  ERC-8004 agent-payment contract        │
                                     └─────────────────────────────────────────┘
```

---

## 3. Layer-by-Layer Breakdown

### 3.1 UI Layer (mostly existing)

| Component | Status | Prototype change |
|---|---|---|
| [src/pages/DashboardHome.tsx](src/pages/DashboardHome.tsx) | existing | Add "Anchored on-chain" + "Paid via" badges per invoice |
| [src/pages/InvoicePage.tsx](src/pages/InvoicePage.tsx) | existing | Add `StorageStatus` and `PaymentStatus` chips |
| [src/components/WalletBadge.tsx](src/components/WalletBadge.tsx) | existing | Already present — reuse |
| `CoPilotPanel` | **new** | Slide-in drawer with chat + suggested actions |
| `PaymentModal` | **new** | Picks x402 / MPP / ERC-8004 and shows tx status |

### 3.2 Agent Runtime (new, small)

Goal: convert natural-language prompts and form fill-ins into deterministic
tool calls against existing services. The prototype uses a single-agent
tool-calling loop (no multi-agent orchestration).

```
src/services/ai/
├── ai-bridge.ts            (existing — provider abstraction)
├── ai-provider.ts          (existing)
├── ai-context-builder.ts   (existing)
├── ai-response-parser.ts   (existing)
└── tools/                  (existing folder — EXTEND)
    ├── generate_invoice.ts       NEW  → calls InvoiceGenerator
    ├── validate_invoice.ts       NEW  → field + anomaly checks
    ├── store_on_ipfs.ts          NEW  → wraps pinata-ipfs.ts
    ├── anchor_on_chain.ts        NEW  → calls InvoiceRegistry
    ├── request_payment.ts        NEW  → delegates to PaymentRouter
    └── export_invoice.ts         NEW  → wraps exportAs{Pdf,Csv}
```

**Agent loop (pseudocode):**

```
system: You are the Invoice Co-Pilot. You can call tools.
user:   "Bill NSUT ₹45,000 for March cloud hosting, milestone payment"
loop:
  llm → tool_call(generate_invoice, {...})
  llm → tool_call(validate_invoice, {invoiceId})
  llm → tool_call(store_on_ipfs, {invoiceId})
  llm → tool_call(anchor_on_chain, {cid, hash})
  llm → tool_call(request_payment, {rail: "mpp", schedule: "milestone"})
  llm → final user-facing summary
```

Each tool is a typed TS function; the agent never touches SQLite/ethers
directly, only through these tools.

### 3.3 Storage Router (new wrapper around existing IPFS code)

```
src/services/storage/
├── storage-router.ts       NEW
├── providers/
│   ├── pinata-provider.ts      wraps existing pinata-ipfs.ts
│   ├── lighthouse-provider.ts  NEW (Filecoin deal creation)
│   └── storacha-provider.ts    NEW (w3up client)
└── local-fallback.ts       NEW (SQLite-only, degraded mode)
```

- Primary: Lighthouse (Filecoin hot storage + deal) for the demo.
- Fallback: existing Pinata flow.
- Every upload returns `{ cid, size, provider, dealId? }`, which is what gets
  anchored on-chain.

### 3.4 Payment Router (new)

```
src/services/payments/
├── payment-router.ts       NEW   single entrypoint for the agent
├── adapters/
│   ├── x402-adapter.ts         HTTP 402 flow (pay-per-request)
│   ├── mpp-tempo-adapter.ts    multi-party / streaming (Tempo SDK)
│   └── erc8004-adapter.ts      agent-initiated on-chain settlement
└── schedulers/
    ├── milestone.ts            triggers payment on event
    └── streaming.ts            time-based (block-based cron)
```

Each adapter implements the same interface:

```ts
interface PaymentAdapter {
  id: 'x402' | 'mpp' | 'erc8004';
  quote(req: PaymentRequest): Promise<Quote>;
  execute(req: PaymentRequest): Promise<PaymentReceipt>;
  status(ref: string): Promise<PaymentStatus>;
}
```

The `PaymentRouter` picks an adapter based on invoice metadata
(`paymentRail` field), so the UI and the agent stay decoupled from the rail.

### 3.5 Blockchain Layer

**One new contract for the prototype:**

```solidity
// contracts/InvoiceRegistry.sol  (deployed on Optimism Sepolia for demo)
contract InvoiceRegistry {
  struct Invoice {
    bytes32 invoiceHash;   // keccak256 of canonical JSON
    string  cid;           // IPFS/Filecoin CID
    address issuer;
    address payer;
    uint256 amount;
    address token;         // address(0) == native
    uint8   status;        // 0=Draft,1=Anchored,2=Paid,3=Disputed
    uint64  createdAt;
  }
  mapping(bytes32 => Invoice) public invoices;   // id = keccak(cid)
  event Anchored(bytes32 id, address issuer, string cid);
  event Paid(bytes32 id, string rail, bytes32 txRef);

  function anchor(...) external returns (bytes32 id);
  function markPaid(bytes32 id, string rail, bytes32 txRef) external;
  // dispute() / resolve() stubbed for future milestone
}
```

- Reuses existing [src/services/blockchain.ts](src/services/blockchain.ts)
  (`ethers` already in deps).
- Deploy script goes under `contracts/` (new top-level folder) using Hardhat
  or Foundry — out of scope for the prototype UI.
- Event subscription lets `DashboardHome` reflect on-chain status live.

### 3.6 Cross-platform / Capacitor

Already in `package.json`:
`@capacitor/filesystem`, `@capacitor/share`, `@capacitor/preferences`,
`capacitor-email-composer`, `@bcyesil/capacitor-plugin-printer`.

Add for the prototype (to satisfy the "3 community plugins" acceptance
criterion if not already counted): `@capacitor/app` deep-link handler wiring
for `invoice://open?cid=...` + `@capacitor/browser` for wallet-connect
fallback on mobile.

---

## 4. Data Flow — End-to-End Happy Path

```
1. User types a prompt in CoPilotPanel
         │
         ▼
2. Agent Runtime → generate_invoice tool
         │  (produces TemplateData, stored via InvoiceContext → SQLite)
         ▼
3. validate_invoice tool (schema + anomaly rules)
         │
         ▼
4. store_on_ipfs tool → StorageRouter → Lighthouse
         │  returns { cid, dealId }
         ▼
5. anchor_on_chain tool → InvoiceRegistry.anchor(cid, hash, …)
         │  returns invoiceId (bytes32)
         ▼
6. request_payment tool → PaymentRouter → (x402 | mpp | erc8004)
         │  returns PaymentReceipt
         ▼
7. On payment event → InvoiceRegistry.markPaid(invoiceId, rail, txRef)
         │
         ▼
8. UI reflects: "Anchored ✓  Paid via MPP ✓"  + Export (PDF/CSV/email)
```

Failure at any step degrades to "saved locally, queued for retry" — the
existing SQLite layer is the source of truth.

---

## 5. Prototype-Scope Deliverables (mid-point milestone)

| # | Deliverable | Where it lives |
|---|---|---|
| 1 | `CoPilotPanel` UI with chat + action chips | `src/components/copilot/` (new) |
| 2 | 6 agent tools wired to existing services | `src/services/ai/tools/` |
| 3 | `StorageRouter` with Lighthouse + Pinata providers | `src/services/storage/` |
| 4 | `PaymentRouter` with **one** working adapter (MPP demo) + stubs for x402/ERC-8004 | `src/services/payments/` |
| 5 | `InvoiceRegistry.sol` deployed to Optimism Sepolia | `contracts/` |
| 6 | Status badges on `DashboardHome` + `InvoicePage` | existing files |
| 7 | PWA build working; Android build reproducible | `npm run build` + `npx cap sync` |
| 8 | Demo script: prompt → anchored → paid in <60s | `CHECKS.md` update |

**Explicitly out of scope for the prototype:**
dispute resolution, multi-tenant access control, fiat on-ramp, full ZK
(Starknet) integration, agent marketplace publishing, push notifications.

---

## 6. Environment & Config

Extend existing `.env.example`:

```bash
# --- Agent ---
VITE_AI_PROVIDER=openai           # or anthropic | local
VITE_AI_API_KEY=
VITE_AI_MODEL=claude-sonnet-4-6   # or gpt-4o-mini

# --- Storage ---
VITE_STORAGE_PRIMARY=lighthouse   # lighthouse | pinata | storacha
VITE_LIGHTHOUSE_API_KEY=
VITE_PINATA_JWT=                  # already present

# --- Chain ---
VITE_CHAIN_ID=11155420            # Optimism Sepolia
VITE_RPC_URL=
VITE_INVOICE_REGISTRY_ADDRESS=

# --- Payments ---
VITE_MPP_ENDPOINT=
VITE_X402_GATEWAY=
VITE_ERC8004_AGENT_ADDRESS=
```

---

## 7. Directory Additions (summary)

```
filcoin-agent-mpp-x422/
├── contracts/                          NEW
│   ├── InvoiceRegistry.sol
│   └── scripts/deploy.ts
├── src/
│   ├── components/copilot/             NEW
│   │   ├── CoPilotPanel.tsx
│   │   └── PaymentModal.tsx
│   └── services/
│       ├── ai/tools/                   EXTEND (6 new tool files)
│       ├── storage/                    NEW (router + 3 providers)
│       └── payments/                   NEW (router + 3 adapters)
└── PROTOTYPE_ARCHITECTURE.md           (this file)
```

---

## 8. Why This Design

- **Small surface area to build.** Only two new UI components, one contract,
  and two routers. Everything else is wrapping existing code.
- **Demo-able in isolation.** Each layer (agent, storage, payment, chain)
  has a clean interface and can be demo'd on its own if one piece fails on
  stage.
- **Composable for the marketplace goal.** The `PaymentAdapter` /
  `StorageProvider` / agent-tool interfaces are the exact shape needed to
  publish the Co-Pilot as a reusable agent on a marketplace later.
- **Forward-compatible.** ZK/Starknet, dispute resolution, and streaming
  payments slot into existing interfaces without schema changes.
