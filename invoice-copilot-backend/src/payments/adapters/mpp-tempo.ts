import { env } from '../../config/env.js';
import type { PaymentAdapter, PaymentRequest, PaymentReceipt } from '../types.js';

/**
 * MPP (Tempo) adapter — Multi-Party Payment / streaming payment flows.
 *
 * Supports:
 *  - Milestone-based disbursement (release on event)
 *  - Streaming (time-based continuous release)
 *  - Multi-recipient splits
 */
export const mppTempo: PaymentAdapter = {
  id: 'mpp',

  async quote(req: PaymentRequest) {
    const milestoneCount = req.milestones?.length ?? 1;
    return {
      rail: 'mpp' as const,
      amount: req.amount,
      currency: req.currency,
      milestoneCount,
      streaming: !req.milestones,
    };
  },

  async execute(req: PaymentRequest): Promise<PaymentReceipt> {
    if (!env.payments.mppEndpoint) {
      return mockReceipt(req);
    }

    try {
      const res = await fetch(`${env.payments.mppEndpoint}/schedule`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoiceId: req.invoiceId,
          total: req.amount,
          currency: req.currency,
          payer: req.payer,
          payee: req.payee,
          milestones: req.milestones,
        }),
      });
      if (!res.ok) throw new Error(`MPP ${res.status}`);
      const data = (await res.json()) as { scheduleId: string; explorer?: string };
      return {
        rail: 'mpp',
        status: req.milestones ? 'pending' : 'settled',
        txRef: data.scheduleId,
        explorerUrl: data.explorer,
        createdAt: new Date().toISOString(),
        raw: data,
      };
    } catch (e) {
      return { ...mockReceipt(req), raw: { error: (e as Error).message, mock: true } };
    }
  },

  async status(txRef: string) {
    return { rail: 'mpp' as const, status: 'pending' as const, txRef, createdAt: new Date().toISOString() };
  },
};

function mockReceipt(req: PaymentRequest): PaymentReceipt {
  return {
    rail: 'mpp',
    status: req.milestones?.length ? 'pending' : 'settled',
    txRef: `mpp-${Date.now()}-${req.invoiceId.slice(2, 10)}`,
    createdAt: new Date().toISOString(),
    raw: { mock: true, milestones: req.milestones },
  };
}
