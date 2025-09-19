import { generateArticle, __setGenerateTextImpl } from '../src/generate-article.ts';

// Mock fetch like test
const originalFetch = globalThis.fetch;
(globalThis as any).fetch = async (url: any, _init?: any) => {
  if (typeof url === 'string' && url.includes('/chat/completions')) {
    const body = JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        title: 'Dbg Title', description: 'Dbg', slug: 'dbg-title', tags: [], categories: [], outline: [
          { heading: 'H1', subheadings: ['S1','S2'] }
        ] }) }}],
      usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 }
    });
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  throw new Error('Unexpected URL ' + url);
};

__setGenerateTextImpl(async () => ({ text: 'Section body', usage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } }));

const { article } = await generateArticle({
  model: 'openai/gpt-oss-20b',
  topic: 'Dbg',
  keywords: ['a'],
  minWords: 10,
  maxWords: 20,
  existingTags: [],
  existingCategories: [],
  lang: 'en',
  exportModes: [],
  writeFiles: false,
  verbose: false,
});

console.log('Article timings:', article.timings);
console.log('Computed total:', article.timings.endTime - article.timings.startTime, 'reported:', article.timings.totalMs);

(globalThis as any).fetch = originalFetch;
