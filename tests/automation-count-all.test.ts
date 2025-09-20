import {
  autoGenerateArticlesFromTopics,
  __setTopicsGenerateTextImpl,
  __setGenerateTextImpl
} from '../index.js';

// Mock topics with 4 entries
const mockTopics = `[
  {"title":"Alpha","confidence":0.9,"riskFlags":[]},
  {"title":"Beta","confidence":0.8,"riskFlags":[]},
  {"title":"Gamma","confidence":0.7,"riskFlags":[]},
  {"title":"Delta","confidence":0.6,"riskFlags":[]}
]`;

__setTopicsGenerateTextImpl(async () => ({ text: mockTopics }) as any);
__setGenerateTextImpl(async ({ prompt }: any) => {
  const match = /Alpha|Beta|Gamma|Delta/.exec(prompt);
  const title = match ? match[0] : 'Unknown';
  return { text: `# ${title}\ncontent` } as any;
});

function assert(c: any, m: string) {
  if (!c) throw new Error(m);
}

(async () => {
  const resAllImplicit = await autoGenerateArticlesFromTopics({
    topics: { domain: 'x' },
    article: { exportModes: ['json'] } as any
    // count omitted -> all
  });
  assert(resAllImplicit.articles.length === 4, 'implicit all failed');

  const resAllExplicit = await autoGenerateArticlesFromTopics({
    topics: { domain: 'x' },
    article: { exportModes: ['json'] } as any,
    count: -1
  });
  assert(resAllExplicit.articles.length === 4, 'explicit -1 all failed');
  console.log('automation-count-all.test.ts passed');
})();
