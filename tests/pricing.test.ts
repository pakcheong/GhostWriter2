import { resolvePrices } from '../src/pricing.js';
import { strict as assert } from 'assert';

process.env.PRICE_IN = '0.1';
process.env.PRICE_OUT = '0.2';

const p = resolvePrices(undefined, undefined, undefined);
assert.equal(p.found, true);
assert.equal(p.in, 0.1);
assert.equal(p.out, 0.2);

console.log('pricing.test.ts passed');
