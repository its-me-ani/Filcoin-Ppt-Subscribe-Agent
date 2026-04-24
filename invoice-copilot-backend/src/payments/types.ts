export type { PaymentRequest, PaymentReceipt } from '../types.js';
import type { PaymentRequest, PaymentReceipt } from '../types.js';

export interface PaymentQuote {
  rail: 'x402' | 'mpp' | 'erc8004';
  amount: number;
  currency: string;
  [key: string]: unknown;
}

export interface PaymentAdapter {
  id: 'x402' | 'mpp' | 'erc8004';
  quote(req: PaymentRequest): Promise<PaymentQuote>;
  execute(req: PaymentRequest): Promise<PaymentReceipt>;
  status(txRef: string): Promise<PaymentReceipt>;
}
