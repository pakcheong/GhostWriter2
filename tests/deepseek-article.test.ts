import assert from 'assert';
import { generateArticle } from '../src/article/generate-article.js';

process.env.DEEPSEEK_API_KEY = 'test-deepseek-key';

const originalFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init?: any) => {
  // Minimal Deepseek-like response mock
  const body = init?.body ? JSON.parse(init.body) : {};
  const firstMsg = body.messages?.[0]?.content || '';
  let content: string;
  if (/outline/i.test(firstMsg) || /title/i.test(firstMsg)) {
    content = JSON.stringify({
      title: 'Deepseek Mock Title',
      description: 'Deepseek Desc',
      slug: 'deepseek-mock-title',
      tags: ['deepseek'],
      categories: ['ai'],
      outline: [
        { heading: 'Intro', subheadings: ['Overview'] },
        { heading: 'Details', subheadings: ['Point1', 'Point2'] }
      ]
    });
  } else if (/Summarize the section/i.test(firstMsg)) {
    content = 'Summary line.';
  } else {
    content = 'Section content **bold** [image]img[/image]';
  }
  const json = {
    choices: [{ message: { content } }],
    usage: { prompt_tokens: 5, completion_tokens: 7, total_tokens: 12 }
  };
  return new Response(JSON.stringify(json), { status: 200, headers: { 'Content-Type': 'application/json' } });
}) as any;

try {
  const { article } = await generateArticle({
    topic: 'Deepseek Test Topic',
    keywords: ['deep', 'seek'],
    model: 'deepseek-chat',
    exportModes: [],
    writeFiles: false,
    contextStrategy: 'summary'
  });
  assert.equal(article.model, 'deepseek-chat');
  assert.equal(article.title, 'Deepseek Mock Title');
  assert.ok(Array.isArray(article.sectionTimings) && article.sectionTimings.length === 2);
  console.log('deepseek-article.test.ts passed');
} finally {
  globalThis.fetch = originalFetch;
}
