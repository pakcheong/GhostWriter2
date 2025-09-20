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
  GenerateArticleOptions,
  SectionTiming,
  SubTiming,
  ArticleTimings
} from '../types.js';
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
}): Promise<{ outline: OutlineResult; usage: Usage; modelId: string; ms: number }> {
  const provider = resolveProviderForModel(opts.model);
  const { openai } = getClientForProvider(provider, { verbose: opts.verbose });
  const promptText = buildOutlinePrompt({
    topic: opts.topic,
    keywords: opts.keywords,
    wordCountRange: opts.wordCountRange,
    existingTags: opts.existingTags,
    existingCategories: opts.existingCategories,
    lang: opts.lang
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
      lang: opts.lang
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
    outputDir = path.join(process.cwd(), 'result'),
    singleRunTimestamp,
    writeFiles = true,
    verbose = false,
    printPreview: _ignoredPreview,
    printUsage: printUsageOpt,
    namePattern
  } = options;
  if (!Array.isArray(keywords) || keywords.length === 0)
    throw new Error('keywords must be a non-empty string array.');
  const printUsage = typeof printUsageOpt === 'boolean' ? printUsageOpt : verbose;
  const envModel = process.env.OPENAI_MODEL || process.env.DEEPSEEK_MODEL || process.env.LMSTUDIO_MODEL;
  const model = modelInput || envModel || 'gpt-4o-mini';
  const provider = resolveProviderForModel(model);
  const totalStart = Date.now();
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
      verbose
    });
    const deduped = dedupeOutline(raw, { verbose });
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
  for (let i = 0; i < outline.outline.length; i++) {
    const sec = outline.outline[i];
    const secStart = Date.now();
    const subBlocks: string[] = [];
    const subTimings: SubTiming[] = [];
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
        verbose
      });
      const subMs = Date.now() - subStart;
      const cleaned = text
        .replace(new RegExp(`^## +${sec.heading}\n+`, 'i'), '')
        .replace(new RegExp(`\n## +${sec.heading}\n`, 'gi'), '\n');
      subBlocks.push(cleaned.trim());
      subTimings.push({ title: sh, ms: subMs });
      sectionsUsage = addUsage(sectionsUsage, usage);
    }
    const sectionText = ['## ' + sec.heading, ...subBlocks].join('\n\n');
    sectionBlocks.push(sectionText);
    let summaryMs: number | undefined;
    if (contextStrategy === 'summary') {
      const sumStart = Date.now();
      const { text: sumText, usage } = await generateSummaryInternal({ model, sectionText, lang, verbose });
      summaryMs = Date.now() - sumStart;
      sectionSummaries.push(sumText);
      summaryUsage = addUsage(summaryUsage, usage);
    }
    const secMs = Date.now() - secStart;
    sectionTimings.push({
      heading: sec.heading,
      subheadingCount: sec.subheadings?.length ?? 0,
      ms: secMs,
      subTimings,
      summaryMs
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
  const outDir = outputDir || path.join(process.cwd(), 'result');
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
  if (writeFiles && exportModes.includes('json')) {
    const jsonPath = uniquePath(outDir, baseName, 'json', runTs);
    fs.writeFileSync(jsonPath, JSON.stringify(articleJSON, null, 2), 'utf-8');
    files.json = jsonPath;
    if (verbose) console.log(`JSON saved to ${jsonPath}`);
  }
  if (typeof options.onArticle === 'function') {
    try {
      await options.onArticle(articleJSON);
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
