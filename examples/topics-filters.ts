import { generateTopics } from '../dist/index.js';

(async () => {
  const res = await generateTopics({
    domain: 'frontend performance',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    includeKeywords: ['react','cache'],
    excludeRegex: 'legacy|deprecated',
    limit: 12,
    verbose: true,
    printUsage: true,
  });
  console.log('[sample] filtered topics count:', res.topics.length);
})();
