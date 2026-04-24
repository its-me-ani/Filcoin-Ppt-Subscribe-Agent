import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { agentRouter } from './routes/agent.js';
import { invoicesRouter } from './routes/invoices.js';
import { paymentsRouter } from './routes/payments.js';
import { canAnchorOnChain } from './chain/registry.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    provider: env.ai.provider,
    storage: env.storage.primary,
    chain: { id: env.chain.chainId, anchoring: canAnchorOnChain() },
  });
});

app.use('/api/agent', agentRouter);
app.use('/api/invoices', invoicesRouter);
app.use('/api/payments', paymentsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[error]', err);
  res.status(500).json({ error: err.message });
});

app.listen(env.port, () => {
  console.log(`✓ Invoice Co-Pilot backend listening on :${env.port}`);
  console.log(`  provider=${env.ai.provider}  storage=${env.storage.primary}  chain=${env.chain.chainId}`);
  console.log(`  on-chain anchoring: ${canAnchorOnChain() ? 'enabled' : 'mock (set RPC_URL + INVOICE_REGISTRY_ADDRESS + BACKEND_SIGNER_PRIVATE_KEY)'}`);
});
