import { JsonRpcProvider, Wallet, Contract, keccak256, toUtf8Bytes, ZeroAddress } from 'ethers';
import { env } from '../config/env.js';
import type { AnchorReceipt } from '../types.js';

const REGISTRY_ABI = [
  'function anchor(string cid, bytes32 invoiceHash, address payer, uint256 amount, address token) external returns (bytes32)',
  'function markPaid(bytes32 id, string rail, bytes32 txRef) external',
  'function getInvoice(bytes32 id) external view returns (tuple(bytes32 invoiceHash, string cid, address issuer, address payer, uint256 amount, address token, uint8 status, uint64 createdAt))',
  'event Anchored(bytes32 indexed id, address indexed issuer, string cid, uint64 createdAt)',
  'event Paid(bytes32 indexed id, string rail, bytes32 txRef)',
];

function signer() {
  const provider = new JsonRpcProvider(env.chain.rpcUrl, env.chain.chainId);
  if (!env.chain.signerKey) {
    throw new Error('BACKEND_SIGNER_PRIVATE_KEY not configured — cannot anchor on-chain');
  }
  return new Wallet(env.chain.signerKey, provider);
}

function contract() {
  if (!env.chain.registry) throw new Error('INVOICE_REGISTRY_ADDRESS not configured');
  return new Contract(env.chain.registry, REGISTRY_ABI, signer());
}

export function canAnchorOnChain(): boolean {
  return Boolean(env.chain.registry && env.chain.signerKey && env.chain.rpcUrl);
}

export async function anchorOnChain(params: {
  cid: string;
  invoiceJson: string;
  payer?: string;
  amount: number;
}): Promise<AnchorReceipt> {
  const hash = keccak256(toUtf8Bytes(params.invoiceJson));
  const c = contract();
  console.log('Sending anchor tx to chain...');
  const tx = await c.anchor(
    params.cid,
    hash,
    params.payer ?? ZeroAddress,
    BigInt(Math.round(params.amount * 1_000_000)), // micro-units for demo
    ZeroAddress,
  );
  console.log('Tx sent:', tx.hash, 'waiting for confirmation...');
  const receipt = await tx.wait(1);
  console.log('Tx confirmed!');
  // id = keccak256(cid) per contract convention
  const id = keccak256(toUtf8Bytes(params.cid));
  return {
    invoiceId: id,
    chainId: env.chain.chainId,
    txHash: receipt?.hash ?? tx.hash,
    blockNumber: receipt?.blockNumber,
    registry: env.chain.registry,
  };
}

export async function markPaidOnChain(invoiceId: string, rail: string, txRef: string): Promise<string> {
  const c = contract();
  // txRef can be any string reference from the payment adapter; we hash for bytes32
  const txRefBytes = txRef.startsWith('0x') && txRef.length === 66
    ? txRef
    : keccak256(toUtf8Bytes(txRef));
  const tx = await c.markPaid(invoiceId, rail, txRefBytes);
  const receipt = await tx.wait();
  return receipt?.hash ?? tx.hash;
}

export function mockAnchor(params: { cid: string; invoiceJson: string }): AnchorReceipt {
  const hash = keccak256(toUtf8Bytes(params.invoiceJson));
  const id = keccak256(toUtf8Bytes(params.cid));
  return {
    invoiceId: id,
    chainId: env.chain.chainId,
    txHash: '0x' + hash.slice(2, 66),
    registry: env.chain.registry || '0x0000000000000000000000000000000000000000',
  };
}
