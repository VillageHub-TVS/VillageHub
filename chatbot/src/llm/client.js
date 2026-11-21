import OpenAI from 'openai';
import { config } from '../config.js';

// Works with any OpenAI-compatible provider. Pick one with LLM_BASE_URL + LLM_API_KEY + LLM_MODEL in .env:
//   OpenAI:      (leave LLM_BASE_URL unset)
//   Gemini:      https://generativelanguage.googleapis.com/v1beta/openai/
//   Groq:        https://api.groq.com/openai/v1
//   OpenRouter:  https://openrouter.ai/api/v1
export const llm = new OpenAI({ apiKey: config.llmApiKey, baseURL: config.llmBaseUrl, maxRetries: 3 }); // retries 429/503 "high demand" errors with backoff
