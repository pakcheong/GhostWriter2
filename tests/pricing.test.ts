import assert from 'assert';
import { resolvePrices } from '../src/pricing.js';

// Preserve originals
const originalEnv = { ...process.env };

try {
  // 1. CLI precedence
  let r = resolvePrices('gpt-4o-mini', 1.23, 4.56);
  assert.deepEqual(r, { in: 1.23, out: 4.56, found: true, source: 'cli' });

  // 2. Model env precedence
  process.env.PRICE_GPT4O_MINI_IN = '0.5';
  process.env.PRICE_GPT4O_MINI_OUT = '1.0';
  r = resolvePrices('gpt-4o-mini');
  assert.equal(r.source, 'model');
  assert.equal(r.in, 0.5);
  assert.equal(r.out, 1.0);
  assert.ok(r.pickedInKey && r.pickedOutKey);

  // 3. Global fallback
  delete process.env.PRICE_GPT4O_MINI_IN;
  delete process.env.PRICE_GPT4O_MINI_OUT;
  process.env.PRICE_IN = '0.2';
  process.env.PRICE_OUT = '0.4';
  r = resolvePrices('gpt-4o-mini');
  assert.equal(r.source, 'global');
  assert.equal(r.in, 0.2);
  assert.equal(r.out, 0.4);

  // 4. None
  delete process.env.PRICE_IN;
  delete process.env.PRICE_OUT;
  r = resolvePrices('gpt-4o-mini');
  assert.equal(r.source, 'none');
  assert.equal(r.found, false);
  console.log('pricing.test.ts passed');
} finally {
  // restore
  for (const k of Object.keys(process.env)) delete (process.env as any)[k];
  Object.assign(process.env, originalEnv);
}
