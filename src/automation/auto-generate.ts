import { generateTopics } from '../topics/generate-topics.js';
import { generateArticle } from '../article/generate-article.js';
import type { AutoGenerateOptions, AutoGenerateResult } from './types.js';
import type { ArticleJSON } from '../types.js';
import { mergeRequiredContentLists } from './merge-required-content.js';
// TODO(doc): Document new automation hooks: baseRequiredContent, requiredContentFactory, aggregateCoverage
import type { RequiredContentItem } from '../article/types.js';

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
  const topicsWrapped = await generateTopics({
    ...options.topics,
    limit: topicLimit,
    verbose: options.topics.verbose ?? verbose
  });
  const topicsEndTime = Date.now();
  const topicTitles = topicsWrapped.output.content.topics.map((t: any) => t.title);
  const desiredCount =
    rawCount == null || rawCount === -1 ? topicTitles.length : Math.min(rawCount, topicTitles.length);
  const picked = topicTitles.slice(0, desiredCount);
  if (options.onTopicsResult) {
    try {
      await options.onTopicsResult({ topics: topicTitles, raw: topicsWrapped });
    } catch (err) {
      if (verbose) console.warn('[automation] onTopicsResult error', err);
    }
  }
  const articles: ArticleJSON[] = new Array(picked.length);
  const coveragePerArticle: Array<{
    title: string;
    baseName?: string;
    missing: string[];
    overused?: string[];
  }> = [];
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
        // Build merged requiredContent for this topic (no legacy arrays externally)
        let perTopicFactory: RequiredContentItem[] = [];
        if (options.requiredContentFactory) {
          try {
            perTopicFactory =
              (await options.requiredContentFactory(title, { index: i, topics: picked })) || [];
          } catch (err) {
            if (verbose) console.warn('[automation] requiredContentFactory error', err);
          }
        }
        const mergedRequired = mergeRequiredContentLists([
          options.baseRequiredContent,
          perTopicFactory,
          (options.article as any).requiredContent
        ]);
        // Derive structural arrays purely from merged list
        const outlineHeadings = mergedRequired.filter((r) => r.intent === 'heading').map((r) => r.text);
        const outlineSubheadings = mergedRequired.filter((r) => r.intent === 'subheading').map((r) => r.text);
        const coveragePhrases = mergedRequired
          .filter((r) => r.intent === 'mention' || r.intent === 'section')
          .map((r) => r.text);
        if (verbose) {
          const mentions = mergedRequired.filter((r) => r.intent === 'mention').length;
          const sections = mergedRequired.filter((r) => r.intent === 'section').length;
          const withMax = mergedRequired.filter((r) => r.maxMentions).length;
          console.log(
            `[automation] requiredContent index=${i + 1} headings=${outlineHeadings.length} subheadings=${outlineSubheadings.length} mentions=${mentions} sections=${sections} maxTagged=${withMax}`
          );
        }
        const { article } = await generateArticle({
          ...(options.article as any),
          // ensure we override any legacy arrays with derived ones
          requiredContent: mergedRequired,
          requiredOutlineHeadings: outlineHeadings,
          requiredOutlineSubheadings: outlineSubheadings,
          requiredCoveragePhrases: coveragePhrases,
          topic: title,
          keywords:
            options.article.keywords && options.article.keywords.length
              ? options.article.keywords
              : title.split(/\s+/).slice(0, 5),
          onArticle: async (payload) => {
            const wrapped = payload as any;
            const articleObj = wrapped.output || payload; // forward/back compat
            // Capture coverage summary if requested
            if (options.aggregateCoverage && wrapped.output?.runtime?.strategy?.requiredCoverage) {
              const rc = wrapped.output.runtime.strategy.requiredCoverage;
              coveragePerArticle[i] = {
                title: articleObj.content?.title || title,
                baseName: wrapped.output.runtime.baseName,
                missing: rc.missing,
                overused: rc.overused
              };
            }
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
  let coverageSummary: AutoGenerateResult['coverageSummary'] | undefined;
  if (options.aggregateCoverage) {
    // Build aggregate stats
    const requiredSet = new Set<string>();
    const missingCounts: Record<string, number> = {};
    const overusedCounts: Record<string, number> = {};
    for (const row of coveragePerArticle) {
      if (!row) continue;
      for (const m of row.missing || []) {
        missingCounts[m] = (missingCounts[m] || 0) + 1;
        requiredSet.add(m);
      }
      for (const o of row.overused || []) {
        overusedCounts[o] = (overusedCounts[o] || 0) + 1;
        requiredSet.add(o);
      }
    }
    coverageSummary = {
      required: Array.from(requiredSet.values()).sort(),
      missing: missingCounts,
      overused: overusedCounts,
      articles: coveragePerArticle.filter(Boolean)
    };
  }
  return {
    topics: topicTitles,
    articles,
    coverageSummary,
    timings: { startTime, topicsEndTime, endTime, totalMs, topicsMs, articlesMs }
  };
}
