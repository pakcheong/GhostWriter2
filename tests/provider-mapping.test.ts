import assert from 'assert';
import { resolveProviderForModel } from '../src/llm.js';

assert.equal(resolveProviderForModel('gpt-4o-mini'), 'openai');
assert.equal(resolveProviderForModel('deepseek-chat'), 'deepseek');
assert.equal(resolveProviderForModel('llama-3'), 'lmstudio');

let errored = false;
try {
  resolveProviderForModel('non-existent-model');
} catch {
  errored = true;
}
assert.ok(errored, 'Should throw on unknown model');
console.log('provider-mapping.test.ts passed');
