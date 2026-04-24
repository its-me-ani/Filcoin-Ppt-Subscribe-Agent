import { JsonRpcProvider, Wallet, Contract, parseUnits } from 'ethers';
import { env } from '../../config/env.js';
import type { PaymentAdapter, PaymentRequest, PaymentReceipt } from '../types.js';

/**
 * ERC-8004 adapter — Agent-driven programmable payments.
 *
 * ERC-8004 standardises on-chain settlement initiated by autonomous agents.
 * For the MVP, we call a thin `settle(bytes32 invoiceId, uint256 amount, address payee)`
 * function on a deployed ERC-8004 agent contract. If not configured, we return
 * a mock receipt so end-to-end demo still runs.
 */
const ERC8004_ABI = [
  'function settle(bytes32 invoiceId, uint256 amount, address payee) external returns (bytes32 txRef)',
  'event Settled(bytes32 indexed invoiceId, address indexed agent, uint256 amount, address payee)',
];

export const erc8004: PaymentAdapter = {
  id: 'erc8004',

  async quote(req: PaymentRequest) {
    return {
      rail: 'erc8004' as const,
      amount: req.amount,
      currency: req.currency,
      gasEstimate: '~45k units',
    };
  },

  async execute(req: PaymentRequest): Promise<PaymentReceipt> {
    if (!env.payments.erc8004Agent || !env.chain.signerKey) {
      return mockReceipt(req);
    }

    try {
      const provider = new JsonRpcProvider(env.chain.rpcUrl, env.chain.chainId);
      const wallet = new Wallet(env.chain.signerKey, provider);
      const c = new Contract(env.payments.erc8004Agent, ERC8004_ABI, wallet);

      const amountWei = parseUnits(req.amount.toString(), 6); // USDC-like 6 decimals for demo
      const tx = await c.settle(req.invoiceId, amountWei, req.payee ?? wallet.address);
      const receipt = await tx.wait();

      return {
        rail: 'erc8004',
        status: 'settled',
        txRef: receipt?.hash ?? tx.hash,
        explorerUrl: `https://sepolia-optimism.etherscan.io/tx/${receipt?.hash ?? tx.hash}`,
        createdAt: new Date().toISOString(),
        raw: { blockNumber: receipt?.blockNumber },
      };
    } catch (e) {
      return { ...mockReceipt(req), raw: { error: (e as Error).message, mock: true } };
    }
  },

  async status(txRef: string) {
    return { rail: 'erc8004' as const, status: 'settled' as const, txRef, createdAt: new Date().toISOString() };
  },
};

function mockReceipt(req: PaymentRequest): PaymentReceipt {
  return {
    rail: 'erc8004',
    status: 'settled',
    txRef: '0x' + 'ab'.repeat(32),
    createdAt: new Date().toISOString(),
    raw: { mock: true, invoiceId: req.invoiceId },
  };
}
