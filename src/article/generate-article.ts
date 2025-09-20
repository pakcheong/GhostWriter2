import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import Table from 'cli-table3';

import {
  sanitizeMarkdown,
  markdownToHtml,
  sanitizeToJSONObject,
  type Usage,
  emptyUsage,
  addUsage,
  formatUSD,
  costEstimate
} from '../utils.js';
import type {
  ContextStrategy,
  OutlineItem,
  OutlineResult,
  ArticleJSON,
  SectionTiming,
  SubTiming,
  ArticleTimings
} from '../types.js';
import type {
  GenerateArticleOptions,
  GenerateArticleCallbackPayload,
  ArticleContent,
  ArticleRuntime
} from './types.js';
import { buildOutlinePrompt, buildSectionPrompt, buildSummaryPrompt } from './prompts.js';
import { getClientForProvider } from '../model-config.js';
import { extractUsage } from '../usage.js';
import { resolvePrices } from '../pricing.js';
import {
  assembleArticle,
  sanitizeBaseName,
  uniquePath,
  buildHtmlDocument,
  buildMarkdownDocument,
  formatDuration
} from './assembly.js';
import { dedupeOutline, computeDuplicateRatio } from './dedupe.js';
import {
  safeGenerateText,
  resolveProviderForModel,
  __setGenerateTextImpl as __setGenerateTextImplShared
} from '../llm.js';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export { __setGenerateTextImplShared as __setGenerateTextImpl };

async function generateOutlineInternal(opts: {
  model: string;
  topic: string;
  keywords: string[];
  wordCountRange: [number, number];
  existingTags: string[];
  existingCategories: string[];
  lang: string;
  verbose: boolean;
  requiredHeadings?: string[];
  requiredSubheadings?: string[];
}): Promise<{ outline: OutlineResult; usage: Usage; modelId: string; ms: number }> {
  const provider = resolveProviderForModel(opts.model);
  const { openai } = getClientForProvider(provider, { verbose: opts.verbose });
  const promptText = buildOutlinePrompt({
    topic: opts.topic,
    keywords: opts.keywords,
    wordCountRange: opts.wordCountRange,
    existingTags: opts.existingTags,
    existingCategories: opts.existingCategories,
    lang: opts.lang,
    requiredHeadings: opts.requiredHeadings,
    requiredSubheadings: opts.requiredSubheadings
  });
  const t0 = Date.now();
  const res = await safeGenerateText(
    { model: openai(opts.model), prompt: promptText },
    { provider, model: opts.model, phase: 'outline' }
  );
  const ms = Date.now() - t0;
  const usage = extractUsage(res, opts.model, promptText, res.text);
  const json = sanitizeToJSONObject(res.text);
  return { outline: JSON.parse(json) as OutlineResult, usage, modelId: opts.model, ms };
}

async function generateSubsectionMarkdownInternal(opts: {
  model: string;
  topic: string;
  keywords: string[];
  outline: OutlineItem[];
  sectionIndex: number;
  subheading: string;
  styleNotes?: string;
  lang: string;
  contextStrategy: ContextStrategy;
  previousSections: string[];
  previousSummaries: string[];
  verbose: boolean;
  requiredCoveragePhrases?: string[];
  normalizedRequiredContent?: Array<{
    text: string;
    intent: 'heading' | 'subheading' | 'mention' | 'section';
    minMentions: number;
  }>;
}): Promise<{ text: string; usage: Usage; modelId: string; ms: number }> {
  const provider = resolveProviderForModel(opts.model);
  const { openai } = getClientForProvider(provider, { verbose: opts.verbose });
  const section = opts.outline[opts.sectionIndex];
  const contextMessages: { role: 'system' | 'user'; content: string }[] = [
    {
      role: 'system',
      content:
        'You are a precise SEO writer. Output must be Markdown only, no HTML. Use **bold** for emphasis. Include [image]...[/image] once per subheading block.'
    },
    {
      role: 'user',
      content: JSON.stringify({
        topic: opts.topic,
        keywords: opts.keywords,
        outline: opts.outline,
        lang: opts.lang,
        styleNotes: opts.styleNotes
      })
    }
  ];
  if (opts.contextStrategy === 'full' && opts.previousSections.length > 0) {
    contextMessages.push({
      role: 'user',
      content: `Previously written sections:\n\n${opts.previousSections.join('\n\n')}\n\nContinue consistently.`
    });
  }
  if (opts.contextStrategy === 'summary' && opts.previousSummaries.length > 0) {
    contextMessages.push({
      role: 'user',
      content: `Summaries of previous sections:\n- ${opts.previousSummaries.join('\n- ')}\n\nEnsure consistency.`
    });
  }
  contextMessages.push({
    role: 'user',
    content: buildSectionPrompt({
      topic: opts.topic,
      keywords: opts.keywords,
      styleNotes: opts.styleNotes,
      section,
      subheading: opts.subheading,
      lang: opts.lang,
      requiredCoveragePhrases: opts.requiredCoveragePhrases,
      pendingRequiredMentions: (() => {
        if (!opts.normalizedRequiredContent) return undefined;
        const mentionItems = opts.normalizedRequiredContent.filter(
          (i) => i.intent === 'mention' || i.intent === 'section'
        );
        if (!mentionItems.length) return undefined;
        const bodySoFar = opts.previousSections.join('\n\n').toLowerCase();
        const pending = mentionItems
          .filter((m) => {
            const safe = m.text.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const count = (bodySoFar.match(new RegExp(safe, 'g')) || []).length;
            return count < m.minMentions;
          })
          .map((m) => ({ text: m.text, minMentions: m.minMentions }));
        return pending.length ? pending : undefined;
      })()
    })
  });
  const joinedPrompt = contextMessages.map((m) => m.content).join('\n\n');
  const t0 = Date.now();
  const res = await safeGenerateText(
    { model: openai(opts.model), messages: contextMessages },
    { provider, model: opts.model, phase: 'section' }
  );
  const ms = Date.now() - t0;
  const usage = extractUsage(res, opts.model, joinedPrompt, res.text);
  return { text: sanitizeMarkdown(res.text), usage, modelId: opts.model, ms };
}

async function generateSummaryInternal(opts: {
  model: string;
  sectionText: string;
  lang: string;
  verbose: boolean;
}): Promise<{ text: string; usage: Usage; modelId: string; ms: number }> {
  const provider = resolveProviderForModel(opts.model);
  const { openai } = getClientForProvider(provider, { verbose: opts.verbose });
  const prompt = buildSummaryPrompt(opts.sectionText, opts.lang);
  const t0 = Date.now();
  const res = await safeGenerateText(
    { model: openai(opts.model), prompt },
    { provider, model: opts.model, phase: 'summary' }
  );
  const ms = Date.now() - t0;
  const usage = extractUsage(res, opts.model, prompt, res.text);
  return { text: res.text.trim(), usage, modelId: opts.model, ms };
}

export async function generateArticle(
  options: GenerateArticleOptions
): Promise<{ article: ArticleJSON; files?: { json?: string; html?: string; md?: string } }> {
  const {
    model: modelInput,
    topic,
    keywords,
    minWords = 1000,
    maxWords = 1400,
    existingTags = [],
    existingCategories = [],
    styleNotes = 'helpful, concise, SEO-aware',
    lang = 'en',
    contextStrategy = 'outline',
    priceInPerK,
    priceOutPerK,
    exportModes = ['json'],
    outBaseName,
    outputDir = path.join(process.cwd(), '.tmp'),
    requiredOutlineHeadings: rawRequiredOutlineHeadings = [],
    requiredOutlineSubheadings: rawRequiredOutlineSubheadings = [],
    requiredCoveragePhrases: rawRequiredCoveragePhrases = [],
    requiredContent = [],
    singleRunTimestamp,
    writeFiles = true,
    verbose = false,
    printPreview: _ignoredPreview,
    printUsage: printUsageOpt,
    namePattern,
    strictRequired
  } = options;
  if (!Array.isArray(keywords) || keywords.length === 0)
    throw new Error('keywords must be a non-empty string array.');
  const printUsage = typeof printUsageOpt === 'boolean' ? printUsageOpt : verbose;
  const envModel = process.env.OPENAI_MODEL || process.env.DEEPSEEK_MODEL || process.env.LMSTUDIO_MODEL;
  const model = modelInput || envModel || 'gpt-4o-mini';
  const provider = resolveProviderForModel(model);
  const totalStart = Date.now();

  // --- Normalize & merge requiredContent into unified required arrays ---
  // We build finalRequired* arrays used for enforcement & coverage while preserving the
  // originally provided raw lists for echo if needed. requiredContent items with intent:
  //  - heading   -> outline heading requirement
  //  - subheading-> outline subheading requirement
  //  - mention   -> body coverage phrase requirement (minMentions supported)
  //  - section   -> currently treated like 'mention' for coverage; future: full section injection
  // Items without explicit intent default to 'mention'.
  const finalRequiredOutlineHeadings = [...rawRequiredOutlineHeadings];
  const finalRequiredOutlineSubheadings = [...rawRequiredOutlineSubheadings];
  const finalRequiredCoveragePhrases = [...rawRequiredCoveragePhrases];
  interface NormalizedRequiredContentItem {
    id?: string;
    text: string;
    intent: 'heading' | 'subheading' | 'mention' | 'section';
    minMentions: number;
    optional?: boolean;
    matchMode?: 'substring' | 'regex' | 'loose';
    injectStrategy?: 'append-paragraph' | 'append-section' | 'none';
    notes?: string;
    maxMentions?: number;
  }
  const normalizedRequiredContent: NormalizedRequiredContentItem[] = [];
  if (Array.isArray(requiredContent)) {
    for (const item of requiredContent) {
      if (!item || typeof item.text !== 'string') continue;
      const text = item.text.trim();
      if (!text) continue;
      const intent = (item.intent || 'mention') as NormalizedRequiredContentItem['intent'];
      const minMentions = item.minMentions && item.minMentions > 0 ? Math.floor(item.minMentions) : 1;
      const maxMentions = item.maxMentions && item.maxMentions > 0 ? Math.floor(item.maxMentions) : undefined;
      const norm: NormalizedRequiredContentItem = {
        id: item.id,
        text,
        intent,
        minMentions,
        optional: item.optional,
        matchMode: item.matchMode || 'substring',
        injectStrategy: item.injectStrategy || 'none',
        notes: item.notes,
        maxMentions
      };
      normalizedRequiredContent.push(norm);
      if (intent === 'heading') {
        if (!finalRequiredOutlineHeadings.some((h) => h.toLowerCase() === text.toLowerCase()))
          finalRequiredOutlineHeadings.push(text);
      } else if (intent === 'subheading') {
        if (!finalRequiredOutlineSubheadings.some((h) => h.toLowerCase() === text.toLowerCase()))
          finalRequiredOutlineSubheadings.push(text);
      } else {
        if (!finalRequiredCoveragePhrases.some((h) => h.toLowerCase() === text.toLowerCase()))
          finalRequiredCoveragePhrases.push(text);
      }
    }
  }

  let outlineUsage: Usage = emptyUsage();
  let sectionsUsage: Usage = emptyUsage();
  let summaryUsage: Usage = emptyUsage();
  const duplicateWarnThreshold = 0.2;
  let outline: OutlineResult;
  let outlineMs: number;
  let duplicateRatio = 0;
  let outlineAttempts = 0;
  const maxOutlineAttempts = 2;
  while (true) {
    outlineAttempts++;
    const outlineStart = Date.now();
    const { outline: raw, usage: oUsage } = await generateOutlineInternal({
      model,
      topic,
      keywords,
      wordCountRange: [minWords, maxWords],
      existingTags: existingTags.map((s) => s.toLowerCase()),
      existingCategories: existingCategories.map((s) => s.toLowerCase()),
      lang,
      verbose,
      requiredHeadings: finalRequiredOutlineHeadings,
      requiredSubheadings: finalRequiredOutlineSubheadings
    });
    const deduped = dedupeOutline(raw, { verbose });
    // Enforce required outline headings/subheadings if missing
    if (finalRequiredOutlineHeadings.length) {
      const existing = new Set(deduped.outline.map((s) => s.heading.toLowerCase()));
      for (const h of finalRequiredOutlineHeadings) {
        if (!existing.has(h.toLowerCase())) {
          deduped.outline.push({ heading: h, subheadings: [] });
          existing.add(h.toLowerCase());
          if (verbose) console.log(`[outline] injected required heading: ${h}`);
        }
      }
    }
    if (finalRequiredOutlineSubheadings.length) {
      // Attach subheadings to the last required heading if present, else last section
      let target = deduped.outline[deduped.outline.length - 1];
      for (const h of finalRequiredOutlineHeadings) {
        const found = deduped.outline.find((s) => s.heading.toLowerCase() === h.toLowerCase());
        if (found) target = found;
      }
      const existingSubs = new Set<string>(
        deduped.outline.flatMap((s) => s.subheadings.map((sh) => sh.toLowerCase()))
      );
      for (const sh of finalRequiredOutlineSubheadings) {
        if (!existingSubs.has(sh.toLowerCase())) {
          target.subheadings.push(sh);
          existingSubs.add(sh.toLowerCase());
          if (verbose) console.log(`[outline] injected required subheading: ${sh}`);
        }
      }
    }
    duplicateRatio = computeDuplicateRatio(raw, deduped);
    outline = deduped;
    outlineMs = Date.now() - outlineStart;
    outlineUsage = addUsage(outlineUsage, oUsage);
    if (duplicateRatio <= duplicateWarnThreshold || outlineAttempts >= maxOutlineAttempts) break;
    if (verbose)
      console.log(`[outline] High duplicate ratio ${(duplicateRatio * 100).toFixed(1)}% -> retrying once...`);
  }
  const sectionBlocks: string[] = [];
  const sectionSummaries: string[] = [];
  const sectionTimings: SectionTiming[] = [];
  const timingsSectionsBreakdown: ArticleRuntime['timings']['sectionsBreakdown'] = [];
  const usageSectionsBreakdown: ArticleRuntime['usage']['sectionsBreakdown'] = [];
  for (let i = 0; i < outline.outline.length; i++) {
    const sec = outline.outline[i];
    const secStart = Date.now();
    const subBlocks: string[] = [];
    const subTimings: SubTiming[] = [];
    const subDetails: {
      title: string;
      ms: number;
      tokens: { prompt: number; completion: number; total: number };
    }[] = [];
    for (const sh of sec.subheadings) {
      const subStart = Date.now();
      const { text, usage } = await generateSubsectionMarkdownInternal({
        model,
        topic,
        keywords,
        outline: outline.outline,
        sectionIndex: i,
        subheading: sh,
        styleNotes,
        lang,
        contextStrategy,
        previousSections: sectionBlocks,
        previousSummaries: sectionSummaries,
        verbose,
        requiredCoveragePhrases: finalRequiredCoveragePhrases,
        normalizedRequiredContent
      });
      const subMs = Date.now() - subStart;
      const cleaned = text
        .replace(new RegExp(`^## +${sec.heading}\n+`, 'i'), '')
        .replace(new RegExp(`\n## +${sec.heading}\n`, 'gi'), '\n');
      subBlocks.push(cleaned.trim());
      subTimings.push({ title: sh, ms: subMs });
      sectionsUsage = addUsage(sectionsUsage, usage);
      subDetails.push({
        title: sh,
        ms: subMs,
        tokens: {
          prompt: usage.promptTokens,
          completion: usage.completionTokens,
          total: usage.totalTokens
        }
      });
    }
    const sectionText = ['## ' + sec.heading, ...subBlocks].join('\n\n');
    sectionBlocks.push(sectionText);
    let summaryMs: number | undefined;
    let sectionSummaryDetail:
      | { ms: number; tokens: { prompt: number; completion: number; total: number } }
      | undefined;
    if (contextStrategy === 'summary') {
      const sumStart = Date.now();
      const { text: sumText, usage } = await generateSummaryInternal({ model, sectionText, lang, verbose });
      summaryMs = Date.now() - sumStart;
      sectionSummaries.push(sumText);
      summaryUsage = addUsage(summaryUsage, usage);
      sectionSummaryDetail = {
        ms: summaryMs,
        tokens: {
          prompt: usage.promptTokens,
          completion: usage.completionTokens,
          total: usage.totalTokens
        }
      };
    }
    const secMs = Date.now() - secStart;
    sectionTimings.push({
      heading: sec.heading,
      subheadingCount: sec.subheadings?.length ?? 0,
      ms: secMs,
      subTimings,
      summaryMs
    });
    const secPromptTokens = subDetails.reduce((a, d) => a + d.tokens.prompt, 0);
    const secCompletionTokens = subDetails.reduce((a, d) => a + d.tokens.completion, 0);
    const secTotalTokens =
      subDetails.reduce((a, d) => a + d.tokens.total, 0) +
      (sectionSummaryDetail ? sectionSummaryDetail.tokens.total : 0);
    timingsSectionsBreakdown.push({
      heading: sec.heading,
      ms: secMs,
      subheadings: subTimings.map((t) => ({ title: t.title, ms: t.ms })),
      summary: sectionSummaryDetail ? { ms: sectionSummaryDetail.ms } : undefined
    });
    usageSectionsBreakdown.push({
      heading: sec.heading,
      tokens: { prompt: secPromptTokens, completion: secCompletionTokens, total: secTotalTokens },
      subheadings: subDetails.map((d) => ({ title: d.title, tokens: d.tokens })),
      summary: sectionSummaryDetail ? { tokens: { ...sectionSummaryDetail.tokens } } : undefined
    });
  }
  const assembleStart = Date.now();
  const baseArticle = assembleArticle({ meta: outline, sections: sectionBlocks });
  const assembleMs = Date.now() - assembleStart;
  // Normalize markdown to remove escape artifacts / leaked placeholders
  const resolvedPrices = resolvePrices(model, priceInPerK, priceOutPerK);
  const priceIn = resolvedPrices.in;
  const priceOut = resolvedPrices.out;
  const totalUsage: Usage = addUsage(addUsage(outlineUsage, sectionsUsage), summaryUsage);
  const costs = resolvedPrices.found
    ? {
        outline: costEstimate(outlineUsage, priceIn ?? 0, priceOut ?? 0),
        sections: costEstimate(sectionsUsage, priceIn ?? 0, priceOut ?? 0),
        summaries:
          contextStrategy === 'summary' ? costEstimate(summaryUsage, priceIn ?? 0, priceOut ?? 0) : undefined,
        total: costEstimate(totalUsage, priceIn ?? 0, priceOut ?? 0),
        priceInPerK: priceIn ?? undefined,
        priceOutPerK: priceOut ?? undefined
      }
    : undefined;
  const status: ArticleJSON['status'] = duplicateRatio > duplicateWarnThreshold ? 'warning' : 'success';
  if (status === 'warning' && verbose)
    console.log(
      `[status] Outline duplicate ratio ${(duplicateRatio * 100).toFixed(1)}% exceeded ${(duplicateWarnThreshold * 100).toFixed(0)}% threshold.`
    );
  const files: { json?: string; html?: string; md?: string } = {};
  let exportMs = 0;
  const runTs = singleRunTimestamp ?? Date.now();
  const outDir = outputDir || path.join(process.cwd(), '.tmp');
  const defaultBase = sanitizeBaseName(baseArticle.slug || baseArticle.title || 'article');
  let baseName: string;
  if (namePattern) {
    const ts = runTs;
    const d = new Date(ts);
    const pad = (n: number, len = 2) => n.toString().padStart(len, '0');
    const dateStr = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
    const timeStr = `${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
    baseName = sanitizeBaseName(
      namePattern
        .replaceAll('[timestamp]', String(ts))
        .replaceAll('[date]', dateStr)
        .replaceAll('[time]', timeStr)
        .replaceAll('[slug]', baseArticle.slug || defaultBase)
        .replaceAll('[title]', baseArticle.slug || defaultBase)
    );
  } else baseName = sanitizeBaseName(outBaseName || defaultBase);
  if (writeFiles && exportModes.length > 0) {
    const exportStart = Date.now();
    if (exportModes.includes('html')) {
      const htmlPath = uniquePath(outDir, baseName, 'html', runTs);
      const htmlBody = await markdownToHtml(baseArticle.body);
      const doc = buildHtmlDocument(baseArticle.title, htmlBody);
      fs.writeFileSync(htmlPath, doc, 'utf-8');
      files.html = htmlPath;
      if (verbose) console.log(`HTML saved to ${htmlPath}`);
    }
    if (exportModes.includes('md')) {
      const mdPath = uniquePath(outDir, baseName, 'md', runTs);
      const mdDoc = buildMarkdownDocument(baseArticle.title, baseArticle.description, baseArticle.body);
      fs.writeFileSync(mdPath, mdDoc, 'utf-8');
      files.md = mdPath;
      if (verbose) console.log(`Markdown saved to ${mdPath}`);
    }
    exportMs = Date.now() - exportStart;
  }
  const totalMs = Date.now() - totalStart;
  const endTimeNow = Date.now();
  let computedEnd = endTimeNow;
  if (computedEnd < totalStart) computedEnd = totalStart + totalMs;
  const timings: ArticleTimings = {
    totalMs,
    outlineMs: outlineMs!,
    assembleMs,
    exportMs,
    outlineAttempts,
    startTime: totalStart,
    endTime: computedEnd
  };
  const articleJSON: ArticleJSON = {
    ...baseArticle,
    model,
    status,
    timings,
    sectionTimings,
    usage: {
      outline: outlineUsage,
      sections: sectionsUsage,
      summaries: contextStrategy === 'summary' ? summaryUsage : undefined,
      total: totalUsage
    },
    cost: costs
  } as ArticleJSON;
  // Build callback/input/meta wrapper
  const sectionsMs = sectionTimings.reduce((acc, s) => acc + s.ms, 0);
  // Coverage tracking across entire body (enhanced) for merged coverage phrases + requiredContent mentions
  const bodyFull = sectionBlocks.join('\n\n');
  const bodyLower = bodyFull.toLowerCase();
  type CoverageItem = {
    text: string;
    intent: 'mention' | 'section';
    requiredMentions: number;
    foundMentions: number;
    fulfilled: boolean;
    optional?: boolean;
    id?: string;
    minMentions?: number;
    maxMentions?: number;
    overused?: boolean;
    densityPerK?: number;
  };
  const coverageItems: CoverageItem[] = [];
  // Build a lookup for normalized content items that map to mention/section
  const mentionLike = normalizedRequiredContent.filter(
    (i) => i.intent === 'mention' || i.intent === 'section'
  );
  // Start with legacy phrases (raw + requiredContent mapped) ensuring uniqueness (case-insensitive)
  const seenPhrase = new Set<string>();
  const mergedCoverageSources = finalRequiredCoveragePhrases.filter(Boolean);
  for (const phrase of mergedCoverageSources) {
    const key = phrase.toLowerCase();
    if (seenPhrase.has(key)) continue;
    seenPhrase.add(key);
    const meta = mentionLike.find((m) => m.text.toLowerCase() === key);
    let foundMentions = 0;
    // Tokenize by word boundaries for safer counting if not regex
    if (meta?.matchMode === 'regex') {
      try {
        const rx = new RegExp(meta.text, 'gi');
        foundMentions = (bodyFull.match(rx) || []).length;
      } catch {
        foundMentions = bodyLower.includes(key) ? 1 : 0;
      }
    } else if (meta?.matchMode === 'loose') {
      const normBody = bodyLower.replace(/\s+/g, ' ');
      const target = key.replace(/\s+/g, ' ');
      let idx = normBody.indexOf(target);
      while (idx !== -1) {
        foundMentions++;
        idx = normBody.indexOf(target, idx + target.length);
      }
    } else {
      // Build word boundary regex for multi-word or single word (fallback to simple substring if fails)
      try {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const rx = new RegExp(`\\b${escaped}\\b`, 'gi');
        foundMentions = (bodyFull.match(rx) || []).length;
      } catch {
        let idx = bodyLower.indexOf(key);
        while (idx !== -1) {
          foundMentions++;
          idx = bodyLower.indexOf(key, idx + key.length);
        }
      }
    }
    const requiredMentions = meta ? meta.minMentions : 1;
    const maxMentions =
      (meta as any)?.maxMentions && (meta as any).maxMentions > 0 ? (meta as any).maxMentions : undefined;
    coverageItems.push({
      text: phrase,
      intent: meta?.intent === 'section' ? 'section' : 'mention',
      requiredMentions,
      foundMentions,
      fulfilled: foundMentions >= requiredMentions,
      optional: meta?.optional,
      id: meta?.id,
      minMentions: meta?.minMentions,
      maxMentions
    });
  }
  // Compute density & overuse heuristics (simple heuristic: > maxMentions OR > (minMentions*8) & > 12 occurrences)
  const totalBodyTokensApprox = bodyFull.split(/\s+/).length;
  for (const item of coverageItems) {
    item.densityPerK = totalBodyTokensApprox
      ? (item.foundMentions / totalBodyTokensApprox) * 1000
      : undefined;
    const heuristicOver = item.foundMentions > (item.minMentions || 1) * 8 && item.foundMentions > 12;
    if (item.maxMentions && item.foundMentions > item.maxMentions) item.overused = true;
    else if (!item.maxMentions && heuristicOver) item.overused = true;
  }
  const overused = coverageItems.filter((c) => c.overused).map((c) => c.text);
  const fulfilledCoverage = coverageItems.filter((c) => c.fulfilled).map((c) => c.text);
  const missingCoverage = coverageItems.filter((c) => !c.fulfilled && !c.optional).map((c) => c.text);
  const inputPayload = {
    topic,
    keywords,
    minWords,
    maxWords,
    styleNotes,
    lang,
    contextStrategy,
    exportModes,
    modelRequested: modelInput,
    modelResolved: model,
    priceInPerK: priceInPerK,
    priceOutPerK: priceOutPerK,
    existingTags: existingTags.length ? existingTags : undefined,
    existingCategories: existingCategories.length ? existingCategories : undefined,
    namePattern,
    outBaseName,
    writeFiles,
    verbose: verbose || undefined,
    requiredOutlineHeadings: rawRequiredOutlineHeadings.length ? rawRequiredOutlineHeadings : undefined,
    requiredOutlineSubheadings: rawRequiredOutlineSubheadings.length
      ? rawRequiredOutlineSubheadings
      : undefined,
    requiredCoveragePhrases: rawRequiredCoveragePhrases.length ? rawRequiredCoveragePhrases : undefined,
    requiredContent: requiredContent && requiredContent.length ? requiredContent : undefined,
    strictRequired: strictRequired || undefined
  };
  // Build merged content + runtime
  const content: ArticleContent = {
    title: baseArticle.title,
    description: baseArticle.description,
    body: baseArticle.body,
    slug: baseArticle.slug,
    tags: baseArticle.tags,
    categories: baseArticle.categories
  };
  const runtime: ArticleRuntime = {
    runTimestamp: runTs,
    baseName,
    model: { requested: modelInput, resolved: model, provider },
    strategy: {
      context: { requested: contextStrategy, effective: contextStrategy },
      duplicateRatio
    },
    counts: {
      sectionCount: sectionTimings.length,
      subheadingTotal: sectionTimings.reduce((a, s) => a + (s.subheadingCount || 0), 0)
    },
    timings: {
      totalMs,
      outlineMs: outlineMs!,
      sectionsMs,
      assembleMs,
      exportMs,
      outlineAttempts,
      sectionsBreakdown: timingsSectionsBreakdown
    },
    usage: {
      outline: outlineUsage,
      sections: sectionsUsage,
      summaries: contextStrategy === 'summary' ? summaryUsage : undefined,
      total: totalUsage,
      sectionsBreakdown: usageSectionsBreakdown
    },
    pricing: resolvedPrices.found
      ? { inPerK: priceIn ?? undefined, outPerK: priceOut ?? undefined, found: resolvedPrices.found }
      : undefined,
    cost: costs
      ? {
          outline: costs.outline,
          sections: costs.sections,
          summaries: costs.summaries,
          total: costs.total
        }
      : undefined,
    warning: status === 'warning'
    // Embed coverage requirement tracking
    // (kept inside runtime.strategy for minimal surface change elsewhere)
  };
  if (coverageItems.length) {
    const strictFailed = !!(strictRequired && (missingCoverage.length > 0 || overused.length > 0));
    runtime.strategy.requiredCoverage = {
      required: coverageItems.map((c) => c.text),
      fulfilled: fulfilledCoverage,
      missing: missingCoverage,
      overused: overused.length ? overused : undefined,
      strictFailed: strictFailed || undefined,
      items: coverageItems
    };
  }
  const wrappedPayload: GenerateArticleCallbackPayload = {
    output: { content, runtime },
    input: inputPayload
  };
  if (writeFiles && exportModes.includes('json')) {
    const jsonPath = uniquePath(outDir, baseName, 'json', runTs);
    fs.writeFileSync(jsonPath, JSON.stringify(wrappedPayload, null, 2), 'utf-8');
    files.json = jsonPath;
    if (verbose) console.log(`JSON saved to ${jsonPath}`);
  }
  if (typeof options.onArticle === 'function') {
    try {
      await options.onArticle(wrappedPayload);
    } catch (err) {
      if (verbose) console.warn('[onArticle] callback error:', err);
    }
  }
  if (verbose) {
    console.log('\n=== Article Preview & Timings ===');
    console.log(`Title: ${outline.title}`);
    console.log(`Description: ${outline.description}`);
    const combined = new Table({
      head: ['Section', 'Subheadings', 'Duration'],
      colWidths: [30, 90, 14],
      style: { head: [], border: [] },
      wordWrap: true
    });
    for (const t of sectionTimings) {
      const subList = (outline.outline.find((s) => s.heading === t.heading)?.subheadings || [])
        .map((s) => `- ${s}`)
        .join('\n');
      combined.push([t.heading, subList || '(none)', formatDuration(t.ms)]);
    }
    console.log(combined.toString());
    console.log(
      `Outline: ${formatDuration(outlineMs)}  |  Assemble: ${formatDuration(assembleMs)}  |  Export: ${formatDuration(exportMs)}`
    );
    console.log(`Total time: ${formatDuration(totalMs)}`);
  }
  if (printUsage) {
    const usageTable = new Table({
      head: ['Phase', 'Prompt', 'Completion', 'Total', 'Cost'],
      colWidths: [12, 12, 12, 12, 16],
      style: { head: [], border: [] }
    });
    const outlineCost = resolvedPrices.found
      ? costEstimate(outlineUsage, priceIn ?? 0, priceOut ?? 0)
      : undefined;
    const sectionsCost = resolvedPrices.found
      ? costEstimate(sectionsUsage, priceIn ?? 0, priceOut ?? 0)
      : undefined;
    const summaryCost = resolvedPrices.found
      ? costEstimate(summaryUsage, priceIn ?? 0, priceOut ?? 0)
      : undefined;
    const totalCost = resolvedPrices.found
      ? (outlineCost || 0) + (sectionsCost || 0) + (summaryCost || 0)
      : undefined;
    const fmt = (n?: number) => (typeof n === 'number' ? formatUSD(n) : 'n/a');
    console.log('\n=== Usage & Cost ===');
    console.log(`Provider (mapped): ${provider}  Model: ${model}`);
    if (resolvedPrices.found)
      console.log(
        `Pricing (per 1K tokens): input=${priceIn != null ? `$${priceIn}` : 'n/a'}  output=${priceOut != null ? `$${priceOut}` : 'n/a'}`
      );
    else console.log('Pricing (per 1K tokens): n/a (no pricing found)');
    usageTable.push(
      [
        'Outline',
        `${outlineUsage.promptTokens}`,
        `${outlineUsage.completionTokens}`,
        `${outlineUsage.totalTokens}`,
        fmt(outlineCost)
      ],
      [
        'Sections',
        `${sectionsUsage.promptTokens}`,
        `${sectionsUsage.completionTokens}`,
        `${sectionsUsage.totalTokens}`,
        fmt(sectionsCost)
      ]
    );
    if (contextStrategy === 'summary')
      usageTable.push([
        'Summaries',
        `${summaryUsage.promptTokens}`,
        `${summaryUsage.completionTokens}`,
        `${summaryUsage.totalTokens}`,
        fmt(summaryCost)
      ]);
    usageTable.push([
      'TOTAL',
      `${totalUsage.promptTokens}`,
      `${totalUsage.completionTokens}`,
      `${totalUsage.totalTokens}`,
      fmt(totalCost)
    ]);
    console.log(usageTable.toString());
  }
  return { article: articleJSON, files: Object.keys(files).length ? files : undefined };
}
