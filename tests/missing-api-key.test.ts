import assert from 'assert';
import { generateArticle } from '../src/article/generate-article.js';

// Multi-provider missing API key test (deepseek + openai). lmstudio excluded (fallback key allowed).
const originalEnv = { ...process.env };

const CASES: { model: string; label: string; expect: RegExp; keys: string[] }[] = [
  {
    model: 'deepseek-chat',
    label: 'deepseek',
    expect: /Missing DEEPSEEK_API_KEY/i,
    keys: ['DEEPSEEK_API_KEY']
  },
  {
    model: 'gpt-4o-mini',
    label: 'openai',
    expect: /Missing OPENAI_API_KEY/i,
    keys: ['OPENAI_API_KEY']
  }
];

for (const c of CASES) {
  // Remove keys relevant to this provider
  for (const k of c.keys) delete (process.env as any)[k];
  let threw = false;
  try {
    await generateArticle({
      topic: `Missing Key ${c.label}`,
      keywords: ['alpha'],
      model: c.model,
      exportModes: [],
      writeFiles: false
    });
  } catch (err: any) {
    threw = true;
    assert.ok(c.expect.test(err.message), `Expected error ${c.expect} for ${c.label}`);
  }
  assert.ok(threw, `Expected failure for provider ${c.label}`);
  // Restore full env before next case to isolate
  Object.assign(process.env, originalEnv);
}

console.log('missing-api-key.test.ts (multi-provider) passed');
