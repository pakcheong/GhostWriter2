import { autoGenerateArticlesFromTopics } from '../dist/index.js';

(async () => {
  const res = await autoGenerateArticlesFromTopics({
    topics: { domain: 'web performance', model: process.env.OPENAI_MODEL || 'gpt-4o-mini', limit: 6, lang: 'en' },
    article: { model: process.env.OPENAI_MODEL || 'gpt-4o-mini', exportModes: ['json'], contextStrategy: 'outline', writeFiles: false } as any,
    // count omitted -> all topics
    verbose: true
  });
  console.log('[sample] articles generated (all):', res.articles.length);
})();
