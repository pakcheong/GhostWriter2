import { generateArticle, __setGenerateTextImpl } from '../src/generate-article.js';
import assert from 'assert';

__setGenerateTextImpl(async (req: any) => {
  const content = req.prompt || (req.messages||[]).map((m: any)=>m.content).join('\n');
  if (content.includes('outline') || content.includes('JSON schema')) {
    return { text: JSON.stringify({
      title: 'Pattern Title',
      description: 'Desc',
      slug: 'pattern-title',
      tags: [],
      categories: [],
      outline: [ { heading: 'One', subheadings: ['A'] } ]
    }), usage: { promptTokens:1, completionTokens:1, totalTokens:2 }};
  }
  return { text: 'Body **A** [image]x[/image]', usage: { promptTokens:1, completionTokens:1, totalTokens:2 } };
});

const runTs = 1111111111111; // deterministic
const { files } = await generateArticle({
  model: 'gpt-4o-mini',
  topic: 'Pattern',
  keywords: ['k'],
  minWords: 10,
  maxWords: 20,
  existingTags: [],
  existingCategories: [],
  lang: 'en',
  contextStrategy: 'outline',
  exportModes: ['json'],
  outputDir: './output',
  writeFiles: true,
  singleRunTimestamp: runTs,
  namePattern: '[timestamp]-[title]' ,
  verbose: false,
});

assert.ok(files?.json, 'JSON file path expected');
const fname = files!.json!.split('/').pop()!;
assert.ok(fname.startsWith('1111111111111-pattern-title'), 'Pattern not applied to filename');
assert.ok(fname.endsWith('.json')); 
console.log('namePattern.test.ts passed');
