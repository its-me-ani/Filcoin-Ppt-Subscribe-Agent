import { nanoid } from 'nanoid';
import type { InvoiceDraft } from '../../types.js';

/**
 * Heuristic extractor — mirrors what a well-prompted LLM would return.
 * Kept deterministic so the mock agent still produces realistic output for demos.
 */
export async function generateInvoice(args: {
  prompt?: string;
  draft?: Partial<InvoiceDraft>;
}): Promise<InvoiceDraft> {
  const prompt = (args.prompt ?? '').trim();
  const extracted = extractFromPrompt(prompt);

  const draft: InvoiceDraft = {
    id: args.draft?.id ?? `inv_${nanoid(8)}`,
    issuer: {
      name: args.draft?.issuer?.name ?? extracted.issuer ?? 'Your Organisation',
      walletAddress: args.draft?.issuer?.walletAddress,
      gstin: args.draft?.issuer?.gstin,
    },
    payer: {
      name: args.draft?.payer?.name ?? extracted.payer ?? 'Client',
      walletAddress: args.draft?.payer?.walletAddress,
      email: args.draft?.payer?.email,
    },
    items: args.draft?.items ?? extracted.items,
    currency: args.draft?.currency ?? extracted.currency ?? 'INR',
    issuedAt: args.draft?.issuedAt ?? new Date().toISOString(),
    dueDate: args.draft?.dueDate,
    notes: args.draft?.notes ?? prompt,
    paymentRail: args.draft?.paymentRail ?? extracted.rail,
    milestones: args.draft?.milestones ?? extracted.milestones,
  };

  return recompute(draft);
}

export function recompute(d: InvoiceDraft): InvoiceDraft {
  const subtotal = d.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const tax = d.items.reduce((s, i) => s + (i.unitPrice * i.quantity * (i.taxPct ?? 0)) / 100, 0);
  return { ...d, subtotal, tax, total: subtotal + tax };
}

function extractFromPrompt(prompt: string): {
  issuer?: string;
  payer?: string;
  currency?: string;
  rail?: InvoiceDraft['paymentRail'];
  items: { description: string; quantity: number; unitPrice: number; taxPct?: number }[];
  milestones?: { label: string; amount: number }[];
} {
  const currency = /\b(INR|USD|EUR|USDC)\b/i.exec(prompt)?.[1]?.toUpperCase();
  const amount = Number(
    /(?:[₹$€]|rs\.?|usd|inr|eur)\s?([\d,]+(?:\.\d+)?)/i.exec(prompt)?.[1]?.replace(/,/g, '') ??
      /([\d,]+(?:\.\d+)?)\s?(?:inr|rs|usd)/i.exec(prompt)?.[1]?.replace(/,/g, '') ??
      0,
  );

  const payer =
    /(?:bill|invoice|charge)\s+(?:to\s+)?([A-Z][\w &.-]{2,})/i.exec(prompt)?.[1]?.trim();

  const rail: InvoiceDraft['paymentRail'] = /milestone|streaming|multi[- ]party/i.test(prompt)
    ? 'mpp'
    : /agent|automat/i.test(prompt)
      ? 'erc8004'
      : /api|per[- ]call/i.test(prompt)
        ? 'x402'
        : 'manual';

  const items = amount > 0
    ? [{ description: firstLine(prompt) || 'Services', quantity: 1, unitPrice: amount, taxPct: 0 }]
    : [{ description: firstLine(prompt) || 'Services', quantity: 1, unitPrice: 0, taxPct: 0 }];

  const milestones = /milestone/i.test(prompt) && amount > 0
    ? [
        { label: 'Kickoff', amount: amount * 0.3 },
        { label: 'Midpoint', amount: amount * 0.4 },
        { label: 'Delivery', amount: amount * 0.3 },
      ]
    : undefined;

  return {
    payer,
    currency,
    rail,
    items,
    milestones,
  };
}

function firstLine(s: string): string {
  const line = s.split('\n')[0]?.trim() ?? '';
  return line.length > 80 ? line.slice(0, 80) + '…' : line;
}
