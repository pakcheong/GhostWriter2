import assert from 'assert';
import { dedupeOutline, computeDuplicateRatio } from '../src/article/dedupe.js';
import type { OutlineResult } from '../src/types.js';

const raw: OutlineResult = {
  title: 'T',
  description: 'D',
  slug: 't',
  tags: [],
  categories: [],
  outline: [
    { heading: 'Intro', subheadings: ['A', 'B'] },
    { heading: 'Intro ', subheadings: ['a', 'C'] },
    { heading: 'Body', subheadings: ['X'] }
  ]
};

const deduped = dedupeOutline(raw);
assert.equal(deduped.outline.length, 2, 'Should merge duplicate Intro');
const intro = deduped.outline[0];
assert.deepEqual(intro.subheadings.sort(), ['A', 'B', 'C']);
const ratio = computeDuplicateRatio(raw, deduped);
assert.ok(ratio > 0 && ratio <= 1);
console.log('dedupe.test.ts passed');
