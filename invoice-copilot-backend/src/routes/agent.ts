import { Router } from 'express';
import { runAgent, getSession } from '../agent/runtime.js';

export const agentRouter = Router();

agentRouter.post('/chat', async (req, res) => {
  try {
    const { sessionId, message, maxSteps } = req.body ?? {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'message required' });
    }
    const result = await runAgent({ sessionId, userMessage: message, maxSteps });
    return res.json({
      sessionId: result.sessionId,
      turns: result.turns,
      invoice: result.session.invoice,
      storage: result.session.storage,
      anchor: result.session.anchor,
      payment: result.session.payment,
      history: result.session.history,
    });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
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
