# PPT Token — Full Stack Integration Guide

## Project structure

```
ppt-project/
├── contracts/
│   ├── PPTToken.sol           ← ERC-20 with maxSupply, burn, pause
│   └── MedInvoiceContract.sol ← Invoice + subscription + minting
├── scripts/
│   └── deploy.js              ← Deploys both contracts in correct order
├── hardhat.config.js          ← All 10+ supported chains
└── frontend/
    ├── config/
    │   └── chains.js          ← Contract addresses per chainId
    ├── hooks/
    │   └── usePPTInvoice.js   ← All contract calls as a React hook
    └── components/
        └── InvoiceApp.jsx     ← Drop-in React component
```

---

## What changed from original contracts

| Issue | Original | Fixed |
|---|---|---|
| `subscribe()` direction | Sent PPT to user with no balance check | Kept reward model, added `require(balance >= AMOUNT)` guard |
| `mintToken()` cap | No limit — users could mint infinitely | `MAX_MINT_PER_TX` (100 PPT) + global `mintCap` |
| `setMedInvoiceContract` | Same | Same — still one-way. Plan for this at deploy time |
| No `renewSubscription` | Users locked out after expiry | Added `renewSubscription()` |
| No file delete | Files append-only | Added `deleteFile(index)` with swap-and-pop |
| No chain guard | Contracts unaware of which chain | `deployedChainId` immutable + `onlyCorrectChain` modifier |
| No pause | No emergency stop | Added `pause()` / `unpause()` on token |
| No maxSupply | Unbounded mint potential | `maxSupply` immutable set at constructor |

---

## Step 1: Install dependencies

```bash
npm init -y
npm install --save-dev \
  @nomicfoundation/hardhat-toolbox \
  hardhat \
  dotenv

npm install @openzeppelin/contracts
```

Create a `.env` file:
```
PRIVATE_KEY=0xYOUR_DEPLOYER_PRIVATE_KEY
OPSCAN_API_KEY=your_key
POLYGONSCAN_API_KEY=your_key
ARBSCAN_API_KEY=your_key
```

---

## Step 2: Adjust deploy parameters

Open `scripts/deploy.js` and set:
```js
const CONFIG = {
  INITIAL_SUPPLY: 1_000_000,           // minted to your wallet at deploy
  MAX_SUPPLY:     10_000_000,          // hard cap, never exceedable
  USER_MINT_CAP:  parseEther("500000"),// how much users can collectively mint
  FUND_AMOUNT:    parseEther("50000"), // pre-load for subscription rewards (5000 subs)
};
```

---

## Step 3: Deploy to each network

```bash
# Testnet first — always test before mainnet
npx hardhat run scripts/deploy.js --network opSepolia
npx hardhat run scripts/deploy.js --network amoy
npx hardhat run scripts/deploy.js --network baseSepolia

# Mainnet when ready
npx hardhat run scripts/deploy.js --network opMainnet
npx hardhat run scripts/deploy.js --network polygon
npx hardhat run scripts/deploy.js --network filecoin
```

Each run prints:
```
  10: {
    token:   "0xNEW_ADDRESS",
    invoice: "0xNEW_ADDRESS",
    name:    "opMainnet",
  },
```
Copy this output into `frontend/config/chains.js`.

---

## Step 4: Fund the invoice contract

The deploy script does this automatically (Step 4/5).
But if you want to add more PPT later:

```js
// In a hardhat task or separate script:
await token.approve(invoiceAddress, parseEther("10000"));
await invoice.fundContract(parseEther("10000")); // funds 1000 more subscriptions
```

Or call directly from your wallet via the block explorer's "Write Contract" tab.

---

## Step 5: Set up the frontend

```bash
# In your React project
npm install wagmi viem @tanstack/react-query
```

Copy the three frontend files into your project:
- `frontend/config/chains.js`     → `src/config/chains.js`
- `frontend/hooks/usePPTInvoice.js` → `src/hooks/usePPTInvoice.js`
- `frontend/components/InvoiceApp.jsx` → `src/components/InvoiceApp.jsx`

Set up wagmi in your `main.jsx` or `App.jsx`:

```jsx
import { WagmiProvider, createConfig, http } from 'wagmi'
import { optimism, polygon, filecoin } from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { injected, walletConnect } from 'wagmi/connectors'

const queryClient = new QueryClient()

const config = createConfig({
  chains: [optimism, polygon, filecoin],
  connectors: [injected(), walletConnect({ projectId: 'YOUR_WC_PROJECT_ID' })],
  transports: {
    [optimism.id]: http(),
    [polygon.id]:  http(),
    [filecoin.id]: http('https://api.node.glif.io/rpc/v1'),
  },
})

export default function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <InvoiceApp />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

---

## Step 6: Early token distribution via orgSubscribe

After funding the contract, distribute to early partners:

```js
// hardhat console or separate script
const invoice = await ethers.getContractAt("MedInvoiceContract", INVOICE_ADDR);

await invoice.orgSubscribe("0xPartnerWallet1", "partner@hospital.com");
await invoice.orgSubscribe("0xPartnerWallet2", "partner@logistics.com");
// Each call sends 10 PPT to the partner and activates 1-year subscription
```

---

## Key contract interactions summary

| Action | Who | Requires | Gas |
|---|---|---|---|
| `subscribe()` | Any user | Contract funded, never subscribed | ~80k |
| `renewSubscription()` | Expired user | Contract funded, subscribed before | ~80k |
| `saveFile(cid)` | Any user | >= 1 wei PPT balance | ~60k |
| `deleteFile(i)` | File owner | Own the file | ~40k |
| `getFiles()` | Any user | >= 1 wei PPT balance | 0 (view) |
| `mintToken(amount)` | Subscribed user | Active subscription, amount <= 100 PPT | ~90k |
| `orgSubscribe(addr, email)` | Owner only | Contract funded | ~100k |
| `fundContract(amount)` | Owner only | Prior token.approve() | ~60k |
| `withdrawTokens(amount)` | Owner only | Contract has balance | ~50k |

---

## SushiSwap liquidity pools (existing)

Your existing pools are already live — users can swap into PPT before subscribing:
- Filecoin:  `0x4D6a9ed35609fe08FB7d012AD3372472bb8A3a59`
- OP Mainnet: `0xc2947199226377018340F76799341E48114AA367`
- Polygon:   `0x46f4224418660403e4958b64bab393d0e028fee8`

---

## Monitoring the contract

Check remaining subscription capacity at any time:
```js
const bal = await invoice.getContractBalance()
const subscriptionsRemaining = bal / (10n * 10n**18n)
console.log(`${subscriptionsRemaining} more subscribes possible`)
```

Top up via `fundContract()` whenever needed.
