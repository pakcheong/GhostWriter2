import assert from 'assert';
import { dedupeOutline } from '../src/article/dedupe.js';
import type { OutlineResult } from '../src/types.js';

const input: OutlineResult = {
  title: 'T',
  description: 'D',
  slug: 't',
  tags: [],
  categories: [],
  outline: [
    { heading: 'Introduction to React 19', subheadings: ['Overview', 'Key Features', 'Overview'] },
    { heading: 'Introduction to React 19', subheadings: ['Overview', 'Migration Path'] },
    { heading: 'Performance', subheadings: ['Overview', 'Server Components', 'Server Components'] }
  ]
};

const out = dedupeOutline(input, { verbose: false });

// After merge-based dedupe we expect only two sections: merged 'Introduction to React 19' + 'Performance'
assert.strictEqual(out.outline.length, 2);
assert.strictEqual(out.outline[0].heading, 'Introduction to React 19');
assert.strictEqual(out.outline[1].heading, 'Performance');

// Subheadings for first section should be unique and merged preserving order of first occurrence
assert.deepStrictEqual(out.outline[0].subheadings, ['Overview', 'Key Features', 'Migration Path']);
// Performance section subheadings unique
assert.deepStrictEqual(out.outline[1].subheadings, ['Overview', 'Server Components']);

console.log('dedupe.test.ts passed');
