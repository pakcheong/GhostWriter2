import { generateTopics } from '../dist/index.js';

(async () => {
  const res = await generateTopics({
    domain: 'frontend engineering',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    limit: 8,
    lang: 'en',
    verbose: true,
    printUsage: true
  });
  console.log('[sample] top topic:', res.topics[0]?.title);
})();
