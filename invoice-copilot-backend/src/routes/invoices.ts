import { Router } from 'express';
import { generateInvoice, recompute } from '../agent/tools/generate_invoice.js';
import { validateInvoice } from '../agent/tools/validate_invoice.js';
import { storeInvoice, fetchInvoice } from '../storage/router.js';
import { anchorOnChain, canAnchorOnChain, mockAnchor } from '../chain/registry.js';
import type { InvoiceDraft } from '../types.js';

export const invoicesRouter = Router();

invoicesRouter.post('/generate', async (req, res) => {
  try {
    const invoice = await generateInvoice(req.body ?? {});
    res.json({ invoice });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

invoicesRouter.post('/validate', async (req, res) => {
  try {
    const result = await validateInvoice(req.body as InvoiceDraft);
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

invoicesRouter.post('/store', async (req, res) => {
  try {
    const invoice = recompute(req.body as InvoiceDraft);
    const receipt = await storeInvoice(JSON.stringify(invoice), invoice.id);
    res.json({ receipt, invoice });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

invoicesRouter.post('/anchor', async (req, res) => {
  try {
    const { cid, invoice } = req.body as { cid: string; invoice: InvoiceDraft };
    const canonical = JSON.stringify(recompute(invoice));
    const receipt = canAnchorOnChain()
      ? await anchorOnChain({
          cid,
          invoiceJson: canonical,
          payer: invoice.payer.walletAddress,
          amount: invoice.total ?? 0,
        })
      : mockAnchor({ cid, invoiceJson: canonical });
    res.json({ receipt });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

invoicesRouter.get('/ipfs/:cid', async (req, res) => {
  try {
    const content = await fetchInvoice(req.params.cid);
    res.type('application/json').send(content);
  } catch (e) {
    res.status(404).json({ error: (e as Error).message });
  }
});
