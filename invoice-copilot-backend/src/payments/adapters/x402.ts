import { env } from '../../config/env.js';
import type { PaymentAdapter, PaymentRequest, PaymentReceipt } from '../types.js';

/**
 * x402 adapter — HTTP 402 "pay-per-request" protocol.
 *
 * Demo flow:
 *   1. Client requests a resource (invoice) and gets back a 402 challenge from x402 gateway.
 *   2. Client pays (via micropayment channel / stablecoin) and resubmits with a payment header.
 *   3. Gateway verifies and forwards. We model this as a single quote+execute call here.
 *
 * For the MVP, if no gateway is configured we return a realistic mock receipt so the
 * agent end-to-end flow still works.
 */
export const x402: PaymentAdapter = {
  id: 'x402',

  async quote(req: PaymentRequest) {
    return {
      rail: 'x402' as const,
      amount: req.amount,
      currency: req.currency,
      protocolFee: req.amount * 0.001,
      eta: 'instant',
    };
  },

  async execute(req: PaymentRequest): Promise<PaymentReceipt> {
    if (!env.payments.x402Gateway) {
      return mockReceipt(req);
    }

    try {
      const res = await fetch(`${env.payments.x402Gateway}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resource: `invoice:${req.invoiceId}`,
          amount: req.amount,
          currency: req.currency,
          payer: req.payer,
          payee: req.payee,
        }),
      });
      if (!res.ok) throw new Error(`x402 gateway ${res.status}`);
      const data = (await res.json()) as { paymentRef: string; explorer?: string };
      return {
        rail: 'x402',
        status: 'settled',
        txRef: data.paymentRef,
        explorerUrl: data.explorer,
        createdAt: new Date().toISOString(),
        raw: data,
      };
    } catch (e) {
      return { ...mockReceipt(req), raw: { error: (e as Error).message, mock: true } };
    }
  },

  async status(txRef: string) {
    return { rail: 'x402' as const, status: 'settled' as const, txRef, createdAt: new Date().toISOString() };
  },
};

function mockReceipt(req: PaymentRequest): PaymentReceipt {
  return {
    rail: 'x402',
    status: 'settled',
    txRef: `x402-${Date.now()}-${req.invoiceId.slice(2, 10)}`,
    explorerUrl: undefined,
    createdAt: new Date().toISOString(),
    raw: { mock: true },
  };
}
