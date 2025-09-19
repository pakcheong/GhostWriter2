// consumer.ts
import { generateArticle } from './dist/index.js'; // or '.' after build

(async () => {
  const { article, files } = await generateArticle({
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    topic: 'React 19: What Changes for Production Apps',
    keywords: ['react 19', 'transitions', 'actions', 'server components'],
    minWords: 1200,
    maxWords: 1800,
    existingTags: ['react', 'frontend', 'release'],
    existingCategories: ['technology', 'web'],
    styleNotes: 'actionable, authoritative, developer-friendly',
    lang: 'en',
    contextStrategy: 'summary',

    // Export formats
    exportModes: ['json', 'html', 'md'],

    // Output directory
    outputDir: './output',

    // Demonstrate dynamic filename pattern (tokens: [timestamp] [date] [time] [slug] [title])
    namePattern: '[timestamp]',

    writeFiles: true,
    verbose: false,

    // Optional pricing overrides example:
    // priceInPerK: 0.0003,
    // priceOutPerK: 0.0006,

    // Callback receives full ArticleJSON (with timings, sectionTimings, status)
    onArticle: (a: any) => {
      console.log('[onArticle/openai] status:', a.status, 'outlineMs:', a.timings.outlineMs, 'totalMs:', a.timings.totalMs);
    },
  });

  // console.log('[openai] Generated title:', article.title);
  // console.log('[openai] Files:', files);
})();

// (async () => {
//   const { article, files } = await generateArticle({
//     model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
//     topic: 'React 19: What Changes for Production Apps',
//     keywords: ['react 19', 'transitions', 'actions', 'server components'],
//     minWords: 1200,
//     maxWords: 1800,
//     existingTags: ['react', 'frontend', 'release'],
//     existingCategories: ['technology', 'web'],
//     styleNotes: 'actionable, authoritative, developer-friendly',
//     lang: 'en',
//     contextStrategy: 'summary',

//     exportModes: ['json', 'html', 'md'],
//     outputDir: './output',
//     namePattern: '[date]-[time]-[slug]',
//     writeFiles: true,
//     verbose: true,
//     onArticle: (a: any) => {
//       console.log('[onArticle/deepseek] status:', a.status, 'sections:', a.sectionTimings.length);
//     },
//   });

//   console.log('[deepseek] Generated title:', article.title);
//   console.log('[deepseek] Files:', files);
// })();
