import { generateTopics } from '../dist/index.js';
import type { GenerateTopicsWrappedPayload } from '../src/topics/types.js';

(async () => {
  await generateTopics({
    domain: 'frontend engineering',
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    limit: 8,
    lang: 'en',
    verbose: false,
    printUsage: false,
    onTopics(result: GenerateTopicsWrappedPayload) {
      console.log(result);
      // const {
      //   output: { content, runtime: _runtime },
      //   input
      // } = result;
      // console.log('[callback] received', content.topics.length, 'topics for domain', input.domain);
      // console.log('[callback] top topic:', content.topics[0]?.title);
    }
  });
})();
