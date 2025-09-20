import { autoGenerateArticlesFromTopics } from '../src/automation/auto-generate.js';

async function main() {
  const result = await autoGenerateArticlesFromTopics({
    topics: {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      domain: 'Fintech developments in Malaysia payments',
      limit: 5
    },
    article: {
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      minWords: 900,
      maxWords: 1100,
      requiredContent: [
        { text: 'Regulatory landscape', intent: 'heading' },
        { text: 'Bank Negara Malaysia', intent: 'mention', minMentions: 2, maxMentions: 5 }
      ],
      strictRequired: true,
      exportModes: ['json'],
      writeFiles: true,
      outputDir: '.tmp'
    },
    baseRequiredContent: [
      { text: 'digital banking license', intent: 'mention', minMentions: 1, maxMentions: 4 }
    ],
    requiredContentFactory: (topic) => {
      const lower = topic.toLowerCase();
      const items: any[] = [];
      if (lower.includes('payment')) {
        items.push({ text: 'e-wallet adoption', intent: 'mention', minMentions: 1, maxMentions: 3 });
      }
      if (lower.includes('startup')) {
        items.push({ text: 'funding rounds', intent: 'subheading' });
      }
      return items;
    },
    aggregateCoverage: true,
    count: 1, // only generate 1 article
    concurrency: 1,
    verbose: true
  });

  console.log('\n=== Automation Result Summary ===');
  console.log('Topics picked:', result.topics.slice(0, result.articles.length));
  console.log('Articles generated:', result.articles.length);
  if (result.coverageSummary) {
    console.log('\nCoverage Summary (aggregate missing / overused counts)');
    console.log(JSON.stringify(result.coverageSummary, null, 2));
  }
}

main().catch((err) => {
  console.error('Automation example failed:', err);
  process.exit(1);
});
