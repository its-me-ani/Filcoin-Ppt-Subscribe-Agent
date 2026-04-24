import { Router } from 'express';
import { executePayment, quotePayment } from '../payments/router.js';
import { markPaidOnChain, canAnchorOnChain } from '../chain/registry.js';

export const paymentsRouter = Router();

paymentsRouter.post('/quote', async (req, res) => {
  try {
    const quote = await quotePayment(req.body);
    res.json({ quote });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});

paymentsRouter.post('/execute', async (req, res) => {
  try {
    const receipt = await executePayment(req.body);
    if (canAnchorOnChain() && receipt.status === 'settled' && req.body?.invoiceId) {
      try {
        await markPaidOnChain(req.body.invoiceId, receipt.rail, receipt.txRef);
      } catch {
        /* non-fatal */
      }
    }
    res.json({ receipt });
  } catch (e) {
    res.status(400).json({ error: (e as Error).message });
  }
});
