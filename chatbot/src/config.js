import 'dotenv/config';

function required(name, ...fallbacks) {
  for (const key of [name, ...fallbacks]) {
    if (process.env[key]) return process.env[key];
  }
  throw new Error(`Missing env var ${name}. Copy .env.example to .env and fill it in.`);
}

export const config = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseKey: required('SUPABASE_KEY', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY'),
  llmApiKey: required('LLM_API_KEY', 'GEMINI_API_KEY', 'OPENAI_API_KEY'),
  llmBaseUrl: process.env.LLM_BASE_URL || undefined, // unset = OpenAI
  model: process.env.LLM_MODEL || 'gpt-6-luna',
  port: Number(process.env.CHATBOT_PORT || 3001),
  defaultCity: process.env.DEFAULT_CITY || 'Richmond',
  maxToolRounds: 5,
};
