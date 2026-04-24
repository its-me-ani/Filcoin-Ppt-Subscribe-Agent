# invoice-copilot-contracts

Hardhat project with two contracts:

- **`InvoiceRegistry.sol`** — single anchor contract for the MVP.
  `anchor(cid, hash, payer, amount, token)` → `bytes32 id`,
  `markPaid(id, rail, txRef)`, plus `dispute` / `resolve` stubs.
- **`Erc8004AgentPayments.sol`** — reference agent-initiated settlement
  contract for the ERC-8004 adapter.

## Deploy

```bash
cp .env.example .env       # set DEPLOYER_PRIVATE_KEY
npm install
npx hardhat compile
npm run deploy:optimism-sepolia
# or
npm run deploy:filecoin-calibration
```

Copy the printed `INVOICE_REGISTRY_ADDRESS` into:
- `invoice-copilot-backend/.env` → `INVOICE_REGISTRY_ADDRESS`
- `filcoin-agent-mpp-x422/.env` → `VITE_INVOICE_REGISTRY_ADDRESS` (optional, only if the frontend needs direct reads)

## Supported networks

| Network | Chain ID | RPC |
|---|---|---|
| Optimism Sepolia | 11155420 | `https://sepolia.optimism.io` |
| Base Sepolia | 84532 | `https://sepolia.base.org` |
| Filecoin Calibration | 314159 | `https://api.calibration.node.glif.io/rpc/v1` |

Add more under `hardhat.config.ts` as needed.
