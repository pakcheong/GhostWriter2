import { generateTopics, type GenerateTopicsOptions } from './generate-topics.js';
import { generateArticle } from '../article/generate-article.js';
import type { GenerateArticleOptions } from '../types.js';

export interface GenerateTrendingArticleOptions extends Omit<GenerateTopicsOptions, 'limit'>, Omit<GenerateArticleOptions, 'topic' | 'keywords'> {
  topicLimit?: number;
  autoKeywords?: boolean; // future: derive keywords from title via LLM
  keywords?: string[];    // fallback/manual
}

export async function generateTrendingArticle(options: GenerateTrendingArticleOptions) {
  const { topicLimit = 8, autoKeywords = false, keywords } = options;
  const topicRes = await generateTopics({ domain: options.domain, model: options.model, limit: topicLimit, verbose: options.verbose });
  const pickedIndex = topicRes.selectedIndex;
  if (pickedIndex < 0 || !topicRes.topics[pickedIndex]) throw new Error('No topic selected.');
  const picked = topicRes.topics[pickedIndex];
  let finalKeywords = keywords;
  if (!finalKeywords || finalKeywords.length === 0) {
    if (autoKeywords) {
      // placeholder: naive keyword derivation (split words > 3 chars)
  finalKeywords = Array.from(new Set(picked.title.split(/[^a-zA-Z0-9]+/).filter((w: string) => w.length > 3))).slice(0, 8);
    } else {
      throw new Error('No keywords provided and autoKeywords disabled.');
    }
  }
  const articleRes = await generateArticle({ ...options, topic: picked.title, keywords: finalKeywords });
  return { topicResult: topicRes, articleResult: articleRes };
}
