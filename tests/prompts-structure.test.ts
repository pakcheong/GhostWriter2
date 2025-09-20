import assert from 'assert';
import { buildOutlinePrompt, buildSectionPrompt, buildSummaryPrompt } from '../src/article/prompts.js';

/*
Prompt Structure Spec (version 1)
---------------------------------
We only lock in high-value semantic anchors to avoid brittle failures:
Outline prompt MUST contain:
  - "Produce ONLY a valid JSON outline" (guiding instruction)
  - "Primary topic:" line with the topic
  - "Keyword list:" line reflecting provided keywords
  - STRICT JSON schema phrase ("Return STRICT JSON" or "STRICT JSON" block)
  - A terminal directive limiting output to JSON (e.g. "Return ONLY the JSON object")

Section prompt MUST contain:
  - directive starting with "Write the body for subsection:" and the chosen subheading
  - parent heading inside the same line (parent: "<heading>") OR at least the parent heading token
  - a line beginning with "Global topic:" referencing the topic
  - a line beginning with "Sibling subheadings:" (may be empty or list)
  - a line beginning with "Keywords (natural use):" listing keywords
  - a line beginning with "Style:" and at least one style adjective
  - the word "Constraints:" and a bullet line containing "Markdown ONLY"
  - bullet line referencing image placeholder `[image]` token

Summary prompt MUST contain:
  - starts with a line beginning with "Summarize the following section"
  - bullet constraints phrase like "3-5" and "bullets"
  - a line with "Source section:" followed by original text

We DO NOT assert exact punctuation, counts, or ordering beyond these anchors.
*/

const SPEC_VERSION = 1;
const topic = 'Test Topic';
const keywords = ['alpha', 'beta'];
const outline = buildOutlinePrompt({
  topic,
  keywords,
  wordCountRange: [800, 1200],
  existingTags: ['tag'],
  existingCategories: ['cat'],
  lang: 'en'
});

// Outline assertions
const outlineChecks: { name: string; test: boolean }[] = [
  {
    name: 'json-outline-instruction',
    test: /produce\s+ONLY\s+a\s+valid\s+JSON\s+outline/i.test(outline)
  },
  {
    name: 'primary-topic-line',
    test: new RegExp(`Primary topic:.*${topic.replace(/[-/\\^$*+?.()|[\]{}]/g, '')}`, 'i').test(outline)
  },
  {
    name: 'keyword-list-line',
    test: /Keyword list:/i.test(outline) && /alpha/i.test(outline) && /beta/i.test(outline)
  },
  {
    name: 'strict-json-schema',
    test: /STRICT JSON/i.test(outline)
  },
  {
    name: 'return-only-json',
    test: /Return ONLY the JSON object\.?/i.test(outline)
  }
];
outlineChecks.forEach((c) => assert.ok(c.test, `Outline missing: ${c.name}`));

// Section prompt
const sectionHeading = 'Section H';
const subheading = 'S1';
const section = buildSectionPrompt({
  topic,
  keywords,
  styleNotes: 'concise',
  section: { heading: sectionHeading, subheadings: [subheading, 'S2'] },
  subheading,
  lang: 'en'
});

const sectionChecks: { name: string; test: boolean }[] = [
  {
    name: 'directive-subsection',
    test: new RegExp(`Write the body for subsection:.*${subheading}`, 'i').test(section)
  },
  {
    name: 'parent-heading',
    test: /(parent:\s*"?section h"?)/i.test(section) || new RegExp(sectionHeading, 'i').test(section)
  },
  {
    name: 'global-topic-line',
    test: /Global topic:/i.test(section) && /Test Topic/i.test(section)
  },
  {
    name: 'sibling-subheadings-line',
    test: /Sibling subheadings:/i.test(section)
  },
  {
    name: 'keywords-line',
    test: /Keywords \(natural use\):/i.test(section) && /alpha/i.test(section)
  },
  {
    name: 'style-line',
    test: /Style:/i.test(section)
  },
  {
    name: 'constraints-header',
    test: /Constraints:/i.test(section)
  },
  {
    name: 'markdown-only-bullet',
    test: /Markdown ONLY/i.test(section)
  },
  {
    name: 'image-placeholder',
    test: /\[image\]/i.test(section)
  }
];
sectionChecks.forEach((c) => assert.ok(c.test, `Section missing: ${c.name}`));

// Summary prompt
const rawSectionText = 'Some section body text here.';
const summary = buildSummaryPrompt(rawSectionText, 'en');
const summaryChecks: { name: string; test: boolean }[] = [
  { name: 'summarize-directive', test: /^Summarize the following section/i.test(summary) },
  { name: 'bullet-range', test: /(3-5|3\s*-\s*5).*bullet/i.test(summary) },
  { name: 'source-section-line', test: /Source section:/i.test(summary) },
  { name: 'contains-source-fragment', test: /Some section body text here\./.test(summary) }
];
summaryChecks.forEach((c) => assert.ok(c.test, `Summary missing: ${c.name}`));

if (process.env.DEBUG_PROMPTS === '1') {
  console.log('\n[debug] Prompt Structure Spec version', SPEC_VERSION);
  console.log('--- OUTLINE PROMPT ---');
  console.log(outline);
  console.log('--- SECTION PROMPT ---');
  console.log(section);
  console.log('--- SUMMARY PROMPT ---');
  console.log(summary);
}

console.log('prompts-structure.test.ts passed (spec v' + SPEC_VERSION + ')');
