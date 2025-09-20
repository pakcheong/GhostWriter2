import { autoGenerateArticlesFromTopics } from '../dist/index.js';

(async () => {
  const res = await autoGenerateArticlesFromTopics({
    topics: {
      domain: 'javascript tooling',
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      limit: 9,
      lang: 'en'
    },
    article: {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      exportModes: ['json'],
      contextStrategy: 'outline',
      writeFiles: false
    } as any,
    count: 3,
    concurrency: 3,
    verbose: true
  });
  console.log('[sample] top3 concurrency articles:', res.articles.length);
})();
