import express from 'express';
import cors from 'cors';
import { config } from './config.js';
import { chat } from './chat/chatService.js';

const app = express();
app.use(cors()); // TODO: restrict origins before deploying
app.use(express.json({ limit: '50kb' }));

app.get('/health', (_req, res) => res.json({ ok: true, model: config.model }));

/**
 * POST /api/chat
 * Body: { messages: [{ role: 'user' | 'assistant', content: string }, ...] }
 * The client keeps the conversation and sends the whole history each time (stateless server).
 * Returns: { reply: string, sources: object[] }  (the app can render sources as cards)
 */
app.post('/api/chat', async (req, res) => {
  const { messages } = req.body ?? {};

  const valid =
    Array.isArray(messages) &&
    messages.length > 0 &&
    messages.every(
      (m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.length <= 2000,
    );
  if (!valid) {
    return res.status(400).json({ error: 'Expected { messages: [{ role: "user"|"assistant", content: string }] }' });
  }

  try {
    // Keep only recent turns to bound cost. Clients can't inject system messages because only user/assistant roles pass validation.
    const result = await chat(messages.slice(-20));
    res.json(result);
  } catch (err) {
    console.error('[chat]', err.status ?? '', err.message);
    const busy = err.status === 429 || err.status === 503;
    res.status(busy ? 503 : 502).json({
      error: busy ? 'AI model is busy or rate limited' : 'Chat service unavailable',
      reply: busy
        ? "I'm getting a lot of questions right now. Please try again in a minute, or call 211 for help finding resources."
        : "Sorry, something went wrong. Please try again, or call 211 for help finding resources.",
      sources: [],
    });
  }
});

app.listen(config.port, () => {
  console.log(`VillageHub chatbot listening on http://localhost:${config.port} (model: ${config.model})`);
});
