import type { PaymentRequest, PaymentReceipt } from '../types.js';
import type { PaymentAdapter } from './types.js';
import { x402 } from './adapters/x402.js';
import { mppTempo } from './adapters/mpp-tempo.js';
import { erc8004 } from './adapters/erc8004.js';

const ADAPTERS: Record<string, PaymentAdapter> = {
  x402,
  mpp: mppTempo,
  erc8004,
};

export function getAdapter(rail: PaymentRequest['rail']): PaymentAdapter {
  const a = ADAPTERS[rail];
  if (!a) throw new Error(`Unknown payment rail: ${rail}`);
  return a;
}

export async function executePayment(req: PaymentRequest): Promise<PaymentReceipt> {
  return getAdapter(req.rail).execute(req);
}

export async function quotePayment(req: PaymentRequest) {
  return getAdapter(req.rail).quote(req);
}
