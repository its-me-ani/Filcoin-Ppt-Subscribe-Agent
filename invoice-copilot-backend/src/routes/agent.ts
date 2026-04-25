import { Router } from 'express';
import { runAgent, getSession } from '../agent/runtime.js';

export const agentRouter = Router();

agentRouter.post('/chat', async (req, res) => {
  try {
    const { sessionId, message, maxSteps } = req.body ?? {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message required' });
    }

    // Stream response using NDJSON (Newline Delimited JSON)
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const result = await runAgent({
      sessionId,
      userMessage: message,
      maxSteps,
      onTurn: (turn) => {
        // Send intermediate turn to the client immediately
        res.write(JSON.stringify({ type: 'turn', turn }) + '\n');
      }
    });

    // Final payload with all session info
    res.write(JSON.stringify({
      type: 'done',
      result: {
        sessionId: result.sessionId,
        turns: result.turns,
        invoice: result.session.invoice,
        storage: result.session.storage,
        anchor: result.session.anchor,
        payment: result.session.payment,
        history: result.session.history,
      }
    }) + '\n');
    res.end();
  } catch (e) {
    res.write(JSON.stringify({ type: 'error', error: (e as Error).message }) + '\n');
    res.end();
  }
});

agentRouter.get('/session/:id', (req, res) => {
  const s = getSession(req.params.id);
  if (!s) return res.status(404).json({ error: 'session not found' });
  return res.json({
    sessionId: s.id,
    invoice: s.invoice,
    storage: s.storage,
    anchor: s.anchor,
    payment: s.payment,
    history: s.history,
  });
});
