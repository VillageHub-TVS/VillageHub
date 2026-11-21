import { Platform } from 'react-native';

export type ChatRole = 'user' | 'assistant';

export type ChatTurn = { role: ChatRole; content: string };

export type ClinicSource = {
  id: string | number;
  clinic_name: string;
  clinic_date?: string; // YYYY-MM-DD
  start_time?: string | null; // HH:MM:SS
  end_time?: string | null;
  location?: string | null;
  services?: string[] | null;
  insurance_required?: boolean | null;
  confirmed_by_staff?: boolean;
};

export type ChatReply = { reply: string; sources: ClinicSource[] };

// Set EXPO_PUBLIC_CHATBOT_URL to the deployed chatbot (or your computer's LAN IP when testing on a phone).
const defaultHost = Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001';
const BASE_URL = (process.env.EXPO_PUBLIC_CHATBOT_URL ?? defaultHost).replace(/\/$/, '');

const OFFLINE_REPLY =
  "I can't reach the assistant right now. Check your connection and try again, or call 211 for help finding resources.";

/** Sends the whole conversation (server is stateless) and returns the assistant's reply. */
export async function sendChat(history: ChatTurn[]): Promise<ChatReply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history }),
      signal: controller.signal,
    });
    // The server includes a friendly `reply` even on 502/503, so prefer it.
    const data = await res.json().catch(() => null);
    if (data?.reply) return { reply: data.reply, sources: data.sources ?? [] };
    if (!res.ok) return { reply: OFFLINE_REPLY, sources: [] };
    return { reply: OFFLINE_REPLY, sources: [] };
  } catch {
    return { reply: OFFLINE_REPLY, sources: [] };
  } finally {
    clearTimeout(timer);
  }
}
