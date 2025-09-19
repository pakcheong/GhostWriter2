import { generateArticle, __setGenerateTextImpl } from '../src/generate-article.js';
import { strict as assert } from 'assert';

// Controlled pseudo model behavior.
// We differentiate outline vs section vs summary by inspecting prompt/messages content.
__setGenerateTextImpl(async (req: any) => {
  const content = 'prompt' in req ? req.prompt : req.messages?.map((m: any) => m.content).join('\n') || '';
  // Outline prompt is a single large prompt string (has JSON schema and "title" directive)
  if ('prompt' in req && content.includes('"outline"') || content.includes('JSON schema')) {
    return {
      text: JSON.stringify({
        title: 'E2E Title',
        description: 'E2E description meta.',
        slug: 'e2e-title',
        tags: ['tag1','tag2'],
        categories: ['cat1'],
        outline: [
          { heading: 'Intro', subheadings: ['What', 'Why'] },
          { heading: 'Deep Dive', subheadings: ['How', 'Next'] }
        ]
      }),
      usage: { promptTokens: 5, completionTokens: 10, totalTokens: 15 }
    };
  }
  if (content.includes('Summarize the following')) {
    return { text: 'Short summary.', usage: { promptTokens: 2, completionTokens: 4, totalTokens: 6 } };
  }
  // Section generation
  return {
    text: '## Section Heading\n\n### Subheading\n\nSome **mock** body.\n\n[image]desc[/image]',
    usage: { promptTokens: 3, completionTokens: 7, totalTokens: 10 }
  };
});

const { article } = await generateArticle({
  model: 'gpt-4o-mini',
  topic: 'E2E Testing Topic',
  keywords: ['k1','k2'],
  minWords: 200,
  maxWords: 400,
  existingTags: ['tag1'],
  existingCategories: ['cat1'],
  styleNotes: 'test-style',
  lang: 'en',
  contextStrategy: 'summary',
  exportModes: [],
  writeFiles: false,
  verbose: false,
});

assert.equal(article.title, 'E2E Title');
assert.ok(article.body.includes('**mock**'), 'Body should include mock subsection content');
assert.ok(article.usage.total.totalTokens > 0);
assert.ok(article.tags.includes('tag1'));
assert.ok(article.categories.includes('cat1'));

console.log('integration.e2e.test.ts passed');
