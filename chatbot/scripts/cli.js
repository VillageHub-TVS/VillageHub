// Quick terminal tester: `npm run cli`. Talks to the chat service directly, so the server doesn't need to be running.
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { chat } from '../src/chat/chatService.js';

const rl = readline.createInterface({ input, output });
const history = [];
console.log('VillageHub chatbot CLI. Type "exit" to quit.\n');

while (true) {
  const text = (await rl.question('you> ')).trim();
  if (!text || text === 'exit') break;
  history.push({ role: 'user', content: text });
  try {
    const { reply, sources } = await chat(history);
    history.push({ role: 'assistant', content: reply });
    console.log(`\nbot> ${reply}\n   (${sources.length} records used)\n`);
  } catch (err) {
    console.error('error:', err.message);
    history.pop();
  }
}
rl.close();
