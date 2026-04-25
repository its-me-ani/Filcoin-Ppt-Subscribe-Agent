# Filcoin PPT Subscribe Token & Decentralized Payments Agent App

A comprehensive full-stack ecosystem for decentralized payments, subscriptions, and AI-driven invoice agents using the PPT (Pay-Per-Transaction / Subscribe) Token. The project consists of multiple modules including smart contracts for various chains (Filecoin, Optimism), specialized cross-platform apps via Capacitor/Electron, and backends.

## 🌟 Key Features
- **PPT Token Subscriptions**: Smart contracts to handle recurring payments and subscriptions tokenized on Filecoin (FVM) and Optimism networks.
- **Decentralized Invoicing Application**: Smart contract powered invoices for decentralized service-providers processing.
- **Multi-Platform Agent App**: An Ionic/Capacitor based frontend built with React, Vite, and Electron for an agent-based interface managing subscriptions and payments.
- **Cross-Chain Support**: Targeted for both Filecoin and Optimism environments.

## 📂 Project Structure

This monorepo-style workspace houses the following main components:

### Smart Contracts (Hardhat)
- `PPT-FIL-Token/` - Hardhat project containing the PPT token implementation tailored for the Filecoin Virtual Machine (FVM).
- `PPT-OP-Token/` - Hardhat project containing the PPT token implementation for the Optimism network.
- `invoice-copilot-contracts/` - Smart contracts specific to the decentralized invoicing features.
- `files/` - Contains various standalone contracts like `MedInvoiceContract.sol` and `PPTToken.sol`, alongside deployment scripts.

### Agent Apps & Frontends (React + Vite + Ionic + Electron)
- `filcoin-agent-mpp-x422/` - The main agent interface for multi-platform usage (Web, Electron, Mobile PWA via Capacitor).
- `filcoin-invoice-frontend/` - Specialized frontend facing the invoice and payments side of the dApp.
- `optimism-frontend/` - Frontend interface dedicated to OP network PPT Token integrations.

### Backends
- `invoice-copilot-backend/` - The backend processing layer managing off-chain tasks related to the invoice copilot agent.

## 🚀 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18+ recommended)
- `npm` or `yarn`
- [Hardhat](https://hardhat.org/)
- A web3 wallet (e.g. MetaMask) with testnet funds for Filecoin/Optimism.

### Installation

To set up any of the sub-projects, simply navigate to the directory and run `npm install`.

For example, to setup the main frontend agent app:
```bash
cd filcoin-agent-mpp-x422
npm install
npm run dev
```

### Running Smart Contract Tests

Navigate to any of the contract folders to compile and test:
```bash
cd PPT-FIL-Token
npm install
npx hardhat compile
npx hardhat test
```

## 🛠 Tech Stack
- **Frontend**: React, TypeScript, Vite, Ionic Framework
- **Desktop/Mobile Packaging**: Electron, Capacitor
- **Smart Contracts**: Solidity, Hardhat, Ethers.js / viem
- **Backend**: Node.js, TypeScript

## 📄 License
This project is properly licensed as determined by the `LICENSE` file within the individual directories.
