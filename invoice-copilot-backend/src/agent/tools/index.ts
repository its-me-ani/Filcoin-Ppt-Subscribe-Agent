import { z } from 'zod';
import { generateInvoice, recompute } from './generate_invoice.js';
import { validateInvoice } from './validate_invoice.js';
import { storeInvoice } from '../../storage/router.js';
import { anchorOnChain, canAnchorOnChain, markPaidOnChain, mockAnchor } from '../../chain/registry.js';
import { executePayment, quotePayment } from '../../payments/router.js';
import type { InvoiceDraft } from '../../types.js';
import type { LlmToolSpec } from '../llm.js';

/**
 * Session state shared across tool calls for one agent run. The LLM does not
 * need to pass the invoice around — it lives here keyed by session id.
 */
export interface Session {
  id: string;
  invoice?: InvoiceDraft;
  storage?: { cid: string; provider: string; gatewayUrl: string };
  anchor?: { invoiceId: string; txHash: string };
  payment?: { rail: string; txRef: string; status: string };
  history: { tool: string; ok: boolean; summary: string }[];
}

export const TOOL_SPECS: LlmToolSpec[] = [
  {
    name: 'generate_invoice',
    description: 'Generate a structured invoice draft from a natural-language prompt or partial form data.',
    parameters: {
      type: 'object',
      properties: {
        prompt: { type: 'string', description: 'Free-form invoice request' },
        draft: { type: 'object', description: 'Partial invoice fields from a form', additionalProperties: true },
      },
    },
  },
  {
    name: 'validate_invoice',
    description: 'Check required fields, flag anomalies, and suggest corrections. Called before storage.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'store_on_ipfs',
    description: 'Upload canonical invoice JSON to IPFS/Filecoin. Returns CID.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'anchor_on_chain',
    description: 'Anchor the invoice (CID + hash) on-chain via InvoiceRegistry.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'request_payment',
    description: 'Schedule or execute payment via the chosen rail.',
    parameters: {
      type: 'object',
      properties: {
        rail: { type: 'string', enum: ['x402', 'mpp', 'erc8004'] },
      },
    },
  },
  {
    name: 'export_invoice',
    description: 'Prepare an export bundle (HTML/CSV references) that the client can download or email.',
    parameters: {
      type: 'object',
      properties: { format: { type: 'string', enum: ['html', 'csv', 'email'] } },
    },
  },
];

const argsSchema = {
  generate_invoice: z.object({ prompt: z.string().optional(), draft: z.record(z.any()).optional() }),
  validate_invoice: z.object({}).passthrough(),
  store_on_ipfs: z.object({}).passthrough(),
  anchor_on_chain: z.object({}).passthrough(),
  request_payment: z.object({ rail: z.enum(['x402', 'mpp', 'erc8004']).optional() }),
  export_invoice: z.object({ format: z.enum(['html', 'csv', 'email']).optional() }),
};

export async function runTool(
  session: Session,
  name: string,
  rawArgs: unknown,
): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  try {
    switch (name) {
      case 'generate_invoice': {
        const args = argsSchema.generate_invoice.parse(rawArgs ?? {});
        const invoice = await generateInvoice({
          prompt: args.prompt ?? session.invoice?.notes,
          draft: args.draft as Partial<InvoiceDraft> | undefined,
        });
        session.invoice = invoice;
        session.history.push({ tool: name, ok: true, summary: `Drafted invoice ${invoice.id} — ${invoice.currency} ${invoice.total}` });
        return { ok: true, data: invoice };
      }
      case 'validate_invoice': {
        if (!session.invoice) return { ok: false, error: 'No invoice in session' };
        const result = await validateInvoice(session.invoice);
        session.history.push({
          tool: name,
          ok: result.ok,
          summary: `Validation: ${result.ok ? 'passed' : 'failed'}, ${result.issues.length} issues, ${result.anomalies.length} anomalies`,
        });
        return { ok: result.ok, data: result };
      }
      case 'store_on_ipfs': {
        if (!session.invoice) return { ok: false, error: 'No invoice to store' };
        const canonical = JSON.stringify(recompute(session.invoice));
        const receipt = await storeInvoice(canonical, session.invoice.id);
        session.storage = { cid: receipt.cid, provider: receipt.provider, gatewayUrl: receipt.gatewayUrl };
        session.history.push({ tool: name, ok: true, summary: `Stored on ${receipt.provider} — CID ${receipt.cid.slice(0, 14)}…` });
        return { ok: true, data: receipt };
      }
      case 'anchor_on_chain': {
        if (!session.invoice || !session.storage) return { ok: false, error: 'Invoice must be stored first' };
        const canonical = JSON.stringify(recompute(session.invoice));
        const receipt = canAnchorOnChain()
          ? await anchorOnChain({
              cid: session.storage.cid,
              invoiceJson: canonical,
              payer: session.invoice.payer.walletAddress,
              amount: session.invoice.total ?? 0,
            })
          : mockAnchor({ cid: session.storage.cid, invoiceJson: canonical });
        session.anchor = { invoiceId: receipt.invoiceId, txHash: receipt.txHash };
        session.history.push({ tool: name, ok: true, summary: `Anchored on chain ${receipt.chainId} — tx ${receipt.txHash.slice(0, 12)}…` });
        return { ok: true, data: receipt };
      }
      case 'request_payment': {
        if (!session.invoice || !session.anchor) return { ok: false, error: 'Invoice must be anchored first' };
        const args = argsSchema.request_payment.parse(rawArgs ?? {});
        const rail = (args.rail ?? session.invoice.paymentRail ?? 'x402') as 'x402' | 'mpp' | 'erc8004';
        const receipt = await executePayment({
          invoiceId: session.anchor.invoiceId,
          rail,
          amount: session.invoice.total ?? 0,
          currency: session.invoice.currency,
          payer: session.invoice.payer.walletAddress,
          payee: session.invoice.issuer.walletAddress,
          milestones: session.invoice.milestones,
        });
        session.payment = { rail: receipt.rail, txRef: receipt.txRef, status: receipt.status };
        // If we can write on-chain, record the payment
        if (canAnchorOnChain() && receipt.status === 'settled') {
          try {
            await markPaidOnChain(session.anchor.invoiceId, receipt.rail, receipt.txRef);
          } catch (e) {
            // Non-fatal — payment succeeded, on-chain receipt is bonus
          }
        }
        session.history.push({
          tool: name,
          ok: true,
          summary: `Payment via ${rail}: ${receipt.status} (${receipt.txRef.slice(0, 16)}…)`,
        });
        return { ok: true, data: receipt };
      }
      case 'export_invoice': {
        if (!session.invoice) return { ok: false, error: 'No invoice' };
        const args = argsSchema.export_invoice.parse(rawArgs ?? {});
        const format = args.format ?? 'html';
        const payload = {
          format,
          invoice: session.invoice,
          downloadUrl: session.storage?.gatewayUrl,
        };
        session.history.push({ tool: name, ok: true, summary: `Prepared ${format} export` });
        return { ok: true, data: payload };
      }
      default:
        return { ok: false, error: `Unknown tool: ${name}` };
    }
  } catch (e) {
    const err = (e as Error).message;
    session.history.push({ tool: name, ok: false, summary: `Error: ${err}` });
    return { ok: false, error: err };
  }
}

export { quotePayment };
