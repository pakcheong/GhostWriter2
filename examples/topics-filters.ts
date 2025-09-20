import { generateTopics } from '../dist/index.js';

(async () => {
  const wrapped = await generateTopics({
    domain: 'frontend performance',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    includeKeywords: ['react', 'cache'],
    excludeRegex: 'legacy|deprecated',
    limit: 12,
    verbose: true,
    printUsage: true
  });
  const {
    output: { content }
  } = wrapped as any;
  console.log('[sample] filtered topics count:', content.topics.length);
})();
