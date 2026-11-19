# VillageHub Chatbot

A user-facing AI chatbot that answers questions about upcoming mobile clinics. It reads only from the `mobile_clinics` table in Supabase, which Tyler's email-parsing pipeline fills in.

## How it works

```
mobile app ──POST /api/chat──▶ server.js ──▶ chatService.js ──▶ Gemini
                                                   ▲   │ tool calls
                                                   │   ▼
                                              tools.js ──▶ db/resources.js ──▶ Supabase (mobile_clinics)
```

The model never sees the database directly. It calls `search_mobile_clinics` and `get_mobile_clinic`, and it answers only from what those return.

- Only upcoming clinics are shown. Clinics that already ended today are hidden, and so are rows with status `rejected`.
- Rows with status `pending_review` are shown, and the bot says they haven't been reviewed by staff yet.
- For food, shelter, or anything else, the bot says it doesn't have that information yet and points to 211.

## Setup

1. Copy `.env.example` to `.env` and fill in `SUPABASE_URL`, `SUPABASE_KEY`, and `GEMINI_API_KEY`.
2. In this folder:

```bash
npm install
npm run check   # verifies .env, the mobile_clinics table, and the AI model
npm run cli     # chat in the terminal
npm run dev     # start the API on http://localhost:3001
```

## API

`POST /api/chat` with the full conversation (the server stores nothing):

```bash
curl -X POST localhost:3001/api/chat -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Where can I get a flu shot?"}]}'
```

Response: `{ "reply": "...", "sources": [ ...clinic rows used... ] }`. On rate limits it returns 503 with a friendly `reply` you can show as is.

## Files

| File | Purpose |
|---|---|
| `src/config.js` | Env vars |
| `src/db/resources.js` | `mobile_clinics` queries |
| `src/llm/tools.js` | Tools the model can call |
| `src/llm/prompts.js` | System prompt (tone, safety, accuracy rules) |
| `src/chat/chatService.js` | Tool-calling loop |
| `src/server.js` | Express API |
| `scripts/cli.js` | Terminal chat |
| `scripts/check.js` | Setup checker (`npm run check`) |

## Limits

The Gemini free tier has small daily limits per model, and each question uses 2-3 requests. If replies start failing with rate-limit errors, wait or switch `LLM_MODEL` in `.env`.

## TODO
- [ ] Add food pantries and shelters once those tables exist
- [ ] Add the voting-info tool (P2)
- [ ] Add a chat screen in `mobile/` that calls `/api/chat`
