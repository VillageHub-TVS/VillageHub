import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

const env = process.env;
let failed = false;
const pass = (msg) => console.log(`  ✅ ${msg}`);
const fail = (msg) => { failed = true; console.log(`  ❌ ${msg}`); };

console.log('\n1. Environment');
const supabaseUrl = env.SUPABASE_URL;
const supabaseKey = env.SUPABASE_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;
const llmKey = env.LLM_API_KEY || env.GEMINI_API_KEY || env.OPENAI_API_KEY;
supabaseUrl ? pass('SUPABASE_URL set') : fail('SUPABASE_URL missing in .env');
supabaseKey ? pass('SUPABASE_KEY set') : fail('SUPABASE_KEY missing in .env');
llmKey ? pass('LLM key set') : fail('LLM_API_KEY / GEMINI_API_KEY missing in .env');
env.LLM_MODEL ? pass(`LLM_MODEL = ${env.LLM_MODEL}`) : fail('LLM_MODEL missing in .env');

console.log('\n2. Supabase tables');
if (supabaseUrl && supabaseKey) {
  const sb = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });
  for (const table of ['mobile_clinics']) {
    const { data, error } = await sb.from(table).select('id').limit(50);
    if (error) fail(`${table}: ${error.message}`);
    else if (data.length === 0) fail(`${table}: readable but 0 rows`);
    else pass(`${table}: ${data.length}${data.length === 50 ? '+' : ''} rows readable`);
  }
} else {
  fail('skipped, Supabase env vars missing');
}

console.log('\n3. LLM');
if (llmKey && env.LLM_MODEL) {
  try {
    const llm = new OpenAI({ apiKey: llmKey, baseURL: env.LLM_BASE_URL || undefined, maxRetries: 3 });
    const res = await llm.chat.completions.create({
      model: env.LLM_MODEL,
      messages: [{ role: 'user', content: 'Reply with the single word: ok' }],
    });
    pass(`${env.LLM_MODEL} replied: ${res.choices[0].message.content?.trim()}`);
  } catch (err) {
    fail(`${env.LLM_MODEL}: ${err.status ?? ''} ${err.message}`);
  }
} else {
  fail('skipped, LLM env vars missing');
}

console.log(failed ? '\nSome checks failed. Fix the ❌ items above.\n' : '\nAll good. Run: npm run cli\n');
process.exit(failed ? 1 : 0);
