import { createOpenAI } from '@ai-sdk/openai';
import { maskKey } from './utils.js';

const loggedKeyOnce: Record<string, boolean> = {};

interface ClientOptions { verbose: boolean; }

export function getClientForProvider(provider: 'openai' | 'deepseek', { verbose }: ClientOptions) {
  if (provider === 'deepseek') {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) throw new Error('Missing DEEPSEEK_API_KEY.');
    let base = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
    if (!/\/v\d+$/.test(base)) base = base.replace(/\/$/, '') + '/v1';
    if (!loggedKeyOnce.deepseek && verbose) {
      console.log(`Using Deepseek: ${maskKey(key)}`);
      loggedKeyOnce.deepseek = true;
    }
    const openai = createOpenAI({ apiKey: key, baseURL: base });
    return { openai };
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY.');
  if (!loggedKeyOnce.openai && verbose) {
    console.log(`Using OpenAI: ${maskKey(key)}`);
    loggedKeyOnce.openai = true;
  }
  const openai = createOpenAI({ apiKey: key });
  return { openai };
}
