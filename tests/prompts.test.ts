import { buildOutlinePrompt, buildSectionPrompt, buildSummaryPrompt } from '../src/article/prompts.js';
import { strict as assert } from 'assert';

const outline = buildOutlinePrompt({
  topic: 'Test Topic',
  keywords: ['alpha', 'beta'],
  wordCountRange: [500, 800],
  existingTags: ['dev'],
  existingCategories: ['tech'],
  lang: 'en'
});
assert.ok(outline.includes('Test Topic'));
assert.ok(outline.includes('alpha'));

const section = buildSectionPrompt({
  topic: 'Test Topic',
  keywords: ['k1'],
  styleNotes: 'concise',
  section: { heading: 'Intro', subheadings: ['Overview'] },
  subheading: 'Overview',
  lang: 'en'
});
assert.ok(!section.includes('## Intro'), 'Section prompt should not contain the H2 heading now');
assert.ok(section.includes('Overview'), 'Section prompt must reference the subheading text');

const summary = buildSummaryPrompt('# Heading\nContent', 'en');
assert.ok(summary.includes('Summarize'));

console.log('prompts.test.ts passed');
