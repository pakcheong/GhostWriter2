// Compile-time smoke test for domain-local types.
// Intentionally minimal: focuses on ensuring public typing surface stays valid.
import type { GenerateArticleOptions } from '../src/article/types.js';
import type { GenerateTopicsOptions, TopicCandidate } from '../src/topics/types.js';
import type { AutoGenerateOptions } from '../src/automation/types.js';

// Article options minimal instantiation (not executed)
const articleOpts: GenerateArticleOptions = {
  topic: 'Test',
  keywords: ['a'],
  exportModes: ['json']
};

// Topics options minimal
const topicsOpts: GenerateTopicsOptions = { domain: 'x', limit: 1 };

// Topic candidate structural assertion
const candidate: TopicCandidate = { title: 'X', sourceType: 'llm' };

// Automation options structural (using Omit shapes)
const autoOpts: AutoGenerateOptions = {
  topics: topicsOpts,
  article: { ...articleOpts, keywords: ['a'] },
  concurrency: 1
};

if (!candidate || !autoOpts || !articleOpts || !topicsOpts) {
  throw new Error('unreachable');
}

console.log('types-smoke.test.ts passed');
