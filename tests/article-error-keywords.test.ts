import assert from 'assert';
import { generateArticle } from '../src/article/generate-article.js';

let threw = false;
try {
  await generateArticle({
    topic: 'No Keywords',
    keywords: [],
    model: 'gpt-4o-mini',
    exportModes: [],
    writeFiles: false
  } as any);
} catch (e: any) {
  threw = true;
  assert.ok(/keywords must be/.test(e.message));
}
assert.ok(threw, 'Expected error on empty keywords');
console.log('article-error-keywords.test.ts passed');
