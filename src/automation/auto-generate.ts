import { generateTopics } from '../topics/generate-topics.js';
import { generateArticle } from '../article/generate-article.js';
import type { AutoGenerateOptions, AutoGenerateResult } from './types.js';
import type { ArticleJSON } from '../types.js';

/**
 * High-level automation: generate topics then generate articles for the top N.
 */
export async function autoGenerateArticlesFromTopics(
  options: AutoGenerateOptions
): Promise<AutoGenerateResult> {
  // Interpret count: -1 or undefined => use all topics after generation
  const rawCount = options.count;
  const verbose = options.verbose;
  const startTime = Date.now();
  // Determine a provisional topic generation limit. If count is unknown/all, keep user provided limit or fallback to 10.
  const topicLimit =
    options.topics.limit ?? (typeof rawCount === 'number' && rawCount > 0 ? Math.max(rawCount * 2, 6) : 10);
  const topicsResult = await generateTopics({
    ...options.topics,
    limit: topicLimit,
    verbose: options.topics.verbose ?? verbose
  });
  const topicsEndTime = Date.now();
  const topicTitles = topicsResult.topics.map((t) => t.title);
  const desiredCount =
    rawCount == null || rawCount === -1 ? topicTitles.length : Math.min(rawCount, topicTitles.length);
  const picked = topicTitles.slice(0, desiredCount);
  if (options.onTopicsResult) {
    try {
      await options.onTopicsResult({ topics: topicTitles, raw: topicsResult });
    } catch (err) {
      if (verbose) console.warn('[automation] onTopicsResult error', err);
    }
  }
  const articles: ArticleJSON[] = new Array(picked.length);
  const concurrency = Math.max(1, options.concurrency ?? 2);
  if (verbose)
    console.log(`[automation] starting article generation count=${picked.length} concurrency=${concurrency}`);
  let currentIndex = 0;
  const worker = async () => {
    while (true) {
      const i = currentIndex++;
      if (i >= picked.length) return;
      const title = picked[i];
      if (verbose) console.log(`[automation] worker generating index=${i + 1} title="${title}"`);
      try {
        const { article } = await generateArticle({
          ...(options.article as any),
          topic: title,
          keywords:
            options.article.keywords && options.article.keywords.length
              ? options.article.keywords
              : title.split(/\s+/).slice(0, 5),
          onArticle: async (payload) => {
            const articleObj = (payload as any).output || payload; // forward/back compat
            if (options.article.onArticle) {
              try {
                await (options.article as any).onArticle(payload);
              } catch (err) {
                if (verbose) console.warn('[automation] inner onArticle error', err);
              }
            }
            if (options.onArticle) {
              try {
                await options.onArticle(articleObj, i);
              } catch (err) {
                if (verbose) console.warn('[automation] onArticle hook error', err);
              }
            }
          }
        });
        articles[i] = article;
      } catch (err) {
        if (verbose) console.warn(`[automation] article generation failed index=${i} title="${title}":`, err);
      }
    }
  };
  const workers = Array.from({ length: Math.min(concurrency, picked.length) }, () => worker());
  await Promise.all(workers);
  const endTime = Date.now();
  const topicsMs = topicsEndTime - startTime;
  const articlesMs = endTime - topicsEndTime;
  const totalMs = endTime - startTime;
  if (verbose) {
    const fmt = (ms: number) => {
      const s = ms / 1000;
      if (s < 60) return s.toFixed(2) + 's';
      const m = Math.floor(s / 60);
      const rs = (s - m * 60).toFixed(1);
      return `${m}m ${rs}s`;
    };
    console.log('[automation] Summary');
    console.log(`  Topics phase : ${fmt(topicsMs)} (${picked.length} topics picked)`);
    console.log(`  Articles     : ${fmt(articlesMs)} (concurrency=${concurrency})`);
    console.log(`  Total        : ${fmt(totalMs)}`);
  }
  return {
    topics: topicTitles,
    articles,
    timings: { startTime, topicsEndTime, endTime, totalMs, topicsMs, articlesMs }
  };
}
