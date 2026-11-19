import { llm } from '../llm/client.js';
import { config } from '../config.js';
import { systemPrompt } from '../llm/prompts.js';
import { toolDefinitions, runTool } from '../llm/tools.js';

const FALLBACK_REPLY =
  "Sorry, I'm having trouble looking that up right now. Please try again in a minute, or call 211 for help finding resources.";

/**
 * Runs one chat turn.
 * @param {{role: 'user'|'assistant', content: string}[]} history  prior turns plus the new user message
 * @returns {Promise<{reply: string, sources: object[]}>}
 */
export async function chat(history) {
  const messages = [{ role: 'system', content: systemPrompt() }, ...history];
  const sources = new Map();

  for (let round = 0; round < config.maxToolRounds; round++) {
    const completion = await llm.chat.completions.create({
      model: config.model,
      messages,
      tools: toolDefinitions,
    });

    const msg = completion.choices[0].message;
    messages.push(msg);

    if (!msg.tool_calls?.length) {
      return { reply: msg.content ?? FALLBACK_REPLY, sources: [...sources.values()] };
    }

    for (const call of msg.tool_calls) {
      const output = await runTool(call.function.name, call.function.arguments);
      for (const row of [].concat(output.result ?? []).filter(Boolean)) sources.set(`${row.name}|${row.id}`, row);
      messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(output) });
    }
  }

  return { reply: FALLBACK_REPLY, sources: [...sources.values()] };
}
