import { generateArticle } from './dist/index.js';
import { generateTopics } from './dist/index.js';
import { autoGenerateArticlesFromTopics } from './dist/index.js';

// Helper utilities for nicer callback logging
function fmtDate(ms: number) {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function fmtDuration(ms: number) {
  const totalSeconds = ms / 1000;
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds - m * 60;
  if (m > 0) return `${m}m ${s.toFixed(2)}s`;
  return `${s.toFixed(2)}s`;
}

function logArticle(prefix: string, a: any) {
  const start = a?.timings?.startTime;
  const end = a?.timings?.endTime;
  const totalMs = a?.timings?.totalMs;
  const totalTokens = a?.usage?.total?.totalTokens;
  console.log(
    `[onArticle/${prefix}] status=${a.status} start=${fmtDate(start)} end=${fmtDate(end)} duration=${fmtDuration(totalMs)} tokens=${totalTokens}`
  );
}

// (async () => {
//   const { article: _article, files: _files } = await generateArticle({
//     model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
//     topic: 'React 19: What Changes for Production Apps',
//     keywords: ['react 19', 'transitions', 'actions', 'server components'],
//     minWords: 1200,
//     maxWords: 1800,
//     existingTags: ['react', 'frontend', 'release'],
//     existingCategories: ['technology', 'web'],
//     styleNotes: 'actionable, authoritative, developer-friendly',
//     lang: 'en',
//     contextStrategy: 'summary',

//     // Export formats
//     exportModes: ['json', 'html', 'md'],

//     // Output directory
//     outputDir: './output',

//     // Demonstrate dynamic filename pattern (tokens: [timestamp] [date] [time] [slug] [title])
//     namePattern: '[timestamp]',

//     writeFiles: true,
//     verbose: true,

//     // Optional pricing overrides example:
//     // priceInPerK: 0.0003,
//     // priceOutPerK: 0.0006,

//     // Callback receives full ArticleJSON (with timings, sectionTimings, status)
//     onArticle: (a: any) => logArticle('openai', a),
//   });

//   // console.log('[openai] Generated title:', article.title);
//   // console.log('[openai] Files:', files);
// })();

// (async () => {
//   const { article: _article2, files: _files2 } = await generateArticle({
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
//     onArticle: (a: any) => logArticle('deepseek', a),
//   });

//   // console.log('[deepseek] Generated title:', article.title);
//   // console.log('[deepseek] Files:', files);
// })();

// async function isLmStudioReachable(base?: string) {
//   const controller = new AbortController();
//   const timeout = setTimeout(() => controller.abort(), 1500); // 1.5s quick probe
//   try {
//     const url = (base || 'http://localhost:1234/v1').replace(/\/$/, '') + '/models';
//     const res = await fetch(url, { method: 'GET', signal: controller.signal });
//     clearTimeout(timeout);
//     return res.ok;
//   } catch {
//     clearTimeout(timeout);
//     return false;
//   }
// }

// (async () => {
//   const lmModel = process.env.LMSTUDIO_MODEL || 'openai/gpt-oss-20b';
//   const base = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';
//   const reachable = await isLmStudioReachable(base);
//   if (!reachable) {
//     console.log(`[lmstudio] Skip: endpoint not reachable (${base}).`);
//     return;
//   }
//   const { article: _article3, files: _files3 } = await generateArticle({
//     model: lmModel,
//     topic: 'Edge Optimizations with Local LLMs',
//     keywords: ['local llm', 'inference', 'latency', 'optimization'],
//     minWords: 600,
//     maxWords: 900,
//     existingTags: ['llm', 'performance'],
//     existingCategories: ['ai', 'infrastructure'],
//     styleNotes: 'concise, technical, developer-focused',
//     lang: 'en',
//     contextStrategy: 'outline',
//     exportModes: ['json'],
//     outputDir: './output',
//     namePattern: '[date]-[slug]',
//     writeFiles: true,
//     verbose: true,
//     onArticle: (a: any) => logArticle('lmstudio', a),
//   });
//   // console.log('[lmstudio] Generated title:', article.title);
//   // console.log('[lmstudio] Files:', files);
// })();

// (async () => {
//   try {
//     const res = await generateTopics({
//       domain: 'frontend engineering',
//       model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
//       limit: 10,
//       verbose: true,
//       printUsage: true,
//       onTopics: (t: any) => {
//         const dur = fmtDuration(t.timings.totalMs);
//         console.log(`[onTopics] topics=${t.topics.length} duration=${dur} tokens=${t.usage.total.totalTokens}`);
//       }
//     });
//     const { topics, selectedIndex } = res;
//     const selected = selectedIndex >= 0 ? topics[selectedIndex] : undefined;
//     console.log('[topics] selectedIndex:', selectedIndex, 'title:', selected?.title);
//   console.log('[topics] topics:', topics.map((t: any) => t.title).join(' | '));
//   } catch (err) {
//     console.error('[topics] generation failed:', err);
//   }
// })();

(async () => {
  // Simple automation demo (will generate 2 articles from top topics)
  try {
    const result = await autoGenerateArticlesFromTopics({
      topics: {
        domain: 'web development',
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        limit: 3,
        verbose: false
      },
      article: {
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        minWords: 400,
        maxWords: 600,
        existingTags: [],
        existingCategories: [],
        styleNotes: 'concise, developer-focused',
        lang: 'en',
        contextStrategy: 'outline',
        exportModes: ['json', 'html'],
        outputDir: './output3',
        writeFiles: true,
        verbose: false
      },
      count: -1,
      concurrency: 3,
      verbose: true,
      onTopicsResult: (t: any) => console.log('[automation] topics:', t.topics.slice(0,5).join(' | ')),
      onArticle: (a: any, idx: number) => console.log(`[automation] article ${idx+1} title:`, a.title)
    });
    console.log(result.timings);
    console.log('[automation] generated articles:', result.articles.length);
  } catch (err) {
    console.error('[automation] failed:', err);
  }
})();
