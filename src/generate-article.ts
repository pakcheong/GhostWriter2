// scripts/generate-article.ts
// Library + CLI. Prints the combined "preview + timings" table only AFTER all work is done.

import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { pathToFileURL } from 'url';
import Table from 'cli-table3';

import {
  sanitizeMarkdown,
  markdownToHtml,
  maskKey,
  getArg,
  sanitizeToJSONObject,
  estimateTokens,
  type Usage,
  emptyUsage,
  addUsage,
  formatUSD,
  costEstimate,
} from './utils.js';

dotenv.config({ path: path.join(process.cwd(), '.env') });

export type Provider = 'openai' | 'deepseek';
export type ContextStrategy = 'outline' | 'full' | 'summary';
export type ExportMode = 'json' | 'html' | 'md';

interface OutlineItem {
  heading: string;
  subheadings: string[];
}
interface OutlineResult {
  title: string;
  description: string;
  slug: string;
  outline: OutlineItem[];
  tags: string[];
  categories: string[];
}
interface ArticleBase {
  title: string;
  description: string;
  body: string;
  tags: string[];
  categories: string[];
  slug: string;
}
export interface ArticleJSON extends ArticleBase {
  provider: Provider;
  model: string;
  usage: {
    outline: Usage;
    sections: Usage;
    summaries?: Usage;
    total: Usage;
  };
  cost?: {
    outline?: number;
    sections?: number;
    summaries?: number;
    total?: number;
    priceInPerK?: number;
    priceOutPerK?: number;
  };
}

export interface GenerateArticleOptions {
  provider?: Provider;
  model?: string;
  topic: string;
  keywords: string[];
  minWords?: number;
  maxWords?: number;
  existingTags?: string[];
  existingCategories?: string[];
  styleNotes?: string;
  lang?: string;
  contextStrategy?: ContextStrategy;

  priceInPerK?: string | number;
  priceOutPerK?: string | number;

  exportModes?: ExportMode[];
  outBaseName?: string;
  outputDir?: string;
  singleRunTimestamp?: number;
  writeFiles?: boolean;

  verbose?: boolean;
  printPreview?: boolean; // kept for API compatibility; preview is printed at the end
  printUsage?: boolean;
}

type MaybeUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

let loggedProviderOnce = false;
function createProvider(provider: Provider, verbose: boolean) {
  if (provider === 'deepseek') {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) throw new Error('Missing DEEPSEEK_API_KEY.');
    if (!loggedProviderOnce && verbose) {
      console.log(`Using Deepseek: ${maskKey(key)}`);
      loggedProviderOnce = true;
    }
    return createOpenAI({
      apiKey: key,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
    });
  }
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error('Missing OPENAI_API_KEY.');
  if (!loggedProviderOnce && verbose) {
    console.log(`Using OpenAI: ${maskKey(key)}`);
    loggedProviderOnce = true;
  }
  return createOpenAI({ apiKey: key });
}

function buildOutlinePrompt(params: {
  topic: string;
  keywords: string[];
  wordCountRange: [number, number];
  existingTags: string[];
  existingCategories: string[];
  lang: string;
}) {
  const { topic, keywords, wordCountRange, existingTags, existingCategories, lang } = params;

  return `
You are an expert SEO blog planner.

Return a JSON object with:
- "title": main article title in ${lang}.
- "description": SEO meta description (~150 chars) in ${lang}.
- "slug": lowercase, URL-friendly, hyphenated (keep in English).
- "tags": array of lowercase unique strings.
- "categories": array of lowercase unique strings.
- "outline": array of sections. Each has:
  - "heading": a clear section title in ${lang}.
  - "subheadings": 2–4 concise subheadings in ${lang}.

Constraints:
- Topic: ${topic}
- Target word count: ${wordCountRange[0]}–${wordCountRange[1]}.
- Keywords to emphasize later: ${keywords.join(', ')}.
- Output must be valid JSON only.
Reference taxonomy:
- Available tags: [${existingTags.join(', ')}]
- Available categories: [${existingCategories.join(', ')}]
`.trim();
}

function buildSectionPrompt(context: {
  topic: string;
  keywords: string[];
  styleNotes?: string;
  section: OutlineItem;
  subheading: string;
  lang: string;
}) {
  const { topic, keywords, styleNotes, section, subheading, lang } = context;

  return `
You are an expert SEO blog writer.

Write a Markdown-only section in ${lang}. No HTML tags.

Requirements:
- Start with: "## ${section.heading}"
- Then: "### ${subheading}"
- Write concise, well-structured content. Typically 2–4 paragraphs are sufficient, but feel free to expand with additional paragraphs if the topic benefits from more depth.
- Lists are optional; include a brief list only if it clearly improves clarity or scan-ability.
- Use **bold** for emphasis (no HTML).
- Include exactly one [image]an image description[/image] placeholder for THIS subheading, written in ${lang}.
- Keep content focused on this subheading; avoid repeating previous subheadings.

Context:
- Topic: ${topic}
- Global keywords (bold at least once across this section): ${keywords.join(', ')}
- Style/Tone: ${styleNotes || 'clear, practical, consistent'}
`.trim();
}

function buildSummaryPrompt(sectionText: string, lang: string) {
  return `
Summarize the following Markdown content into 1–2 concise sentences in ${lang}.
The summary should capture the main idea but not exceed 80 words.

Content:
${sectionText}
`.trim();
}

function extractUsage(
  res: unknown,
  modelId: string | undefined,
  promptText: string,
  completionText: string
): Usage {
  const u = (res as { usage?: MaybeUsage } | undefined)?.usage ?? {};
  const promptTokens =
    typeof u.promptTokens === 'number'
      ? u.promptTokens
      : estimateTokens(promptText, modelId);
  const completionTokens =
    typeof u.completionTokens === 'number'
      ? u.completionTokens
      : estimateTokens(completionText, modelId);
  const totalTokens =
    typeof u.totalTokens === 'number'
      ? u.totalTokens
      : promptTokens + completionTokens;

  return { promptTokens, completionTokens, totalTokens };
}

async function generateOutlineInternal(opts: {
  provider: Provider;
  model: string;
  topic: string;
  keywords: string[];
  wordCountRange: [number, number];
  existingTags: string[];
  existingCategories: string[];
  lang: string;
  verbose: boolean;
}): Promise<{ outline: OutlineResult; usage: Usage; modelId: string; ms: number }> {
  const provider = createProvider(opts.provider, opts.verbose);

  const promptText = buildOutlinePrompt({
    topic: opts.topic,
    keywords: opts.keywords,
    wordCountRange: opts.wordCountRange,
    existingTags: opts.existingTags,
    existingCategories: opts.existingCategories,
    lang: opts.lang,
  });

  const t0 = Date.now();
  const res = await generateText({
    model: provider(opts.model),
    prompt: promptText,
  });
  const ms = Date.now() - t0;

  const usage = extractUsage(res, opts.model, promptText, res.text);
  const json = sanitizeToJSONObject(res.text);
  return { outline: JSON.parse(json) as OutlineResult, usage, modelId: opts.model, ms };
}

async function generateSubsectionMarkdownInternal(opts: {
  provider: Provider;
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
  const provider = createProvider(opts.provider, opts.verbose);
  const section = opts.outline[opts.sectionIndex];

  const contextMessages: { role: 'system' | 'user'; content: string }[] = [
    {
      role: 'system',
      content:
        'You are a precise SEO writer. Output must be Markdown only, no HTML. Use **bold** for emphasis. Include [image]...[/image] once per subheading block.',
    },
    {
      role: 'user',
      content: JSON.stringify({
        topic: opts.topic,
        keywords: opts.keywords,
        outline: opts.outline,
        lang: opts.lang,
        styleNotes: opts.styleNotes,
      }),
    },
  ];

  if (opts.contextStrategy === 'full' && opts.previousSections.length > 0) {
    contextMessages.push({
      role: 'user',
      content: `Previously written sections:\n\n${opts.previousSections.join(
        '\n\n'
      )}\n\nContinue consistently.`,
    });
  }

  if (opts.contextStrategy === 'summary' && opts.previousSummaries.length > 0) {
    contextMessages.push({
      role: 'user',
      content: `Summaries of previous sections:\n- ${opts.previousSummaries.join(
        '\n- '
      )}\n\nEnsure consistency.`,
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
    }),
  });

  const joinedPrompt = contextMessages.map((m) => m.content).join('\n\n');

  const t0 = Date.now();
  const res = await generateText({
    model: provider(opts.model),
    messages: contextMessages,
  });
  const ms = Date.now() - t0;

  const usage = extractUsage(res, opts.model, joinedPrompt, res.text);

  return { text: sanitizeMarkdown(res.text), usage, modelId: opts.model, ms };
}

async function generateSummaryInternal(opts: {
  provider: Provider;
  model: string;
  sectionText: string;
  lang: string;
  verbose: boolean;
}): Promise<{ text: string; usage: Usage; modelId: string; ms: number }> {
  const provider = createProvider(opts.provider, opts.verbose);
  const prompt = buildSummaryPrompt(opts.sectionText, opts.lang);

  const t0 = Date.now();
  const res = await generateText({
    model: provider(opts.model),
    prompt,
  });
  const ms = Date.now() - t0;

  const usage = extractUsage(res, opts.model, prompt, res.text);
  return { text: res.text.trim(), usage, modelId: opts.model, ms };
}

function assembleArticle(params: {
  meta: OutlineResult;
  sections: string[];
}): ArticleBase {
  return {
    title: params.meta.title,
    description: params.meta.description,
    body: params.sections.map(sanitizeMarkdown).join('\n\n'),
    tags: Array.from(new Set(params.meta.tags || [])),
    categories: Array.from(new Set(params.meta.categories || [])),
    slug: params.meta.slug,
  };
}

function ensureDir(outDir: string): string {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}
function sanitizeBaseName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '') || 'article';
}
function uniquePath(outDir: string, baseName: string, ext: 'json' | 'html' | 'md', runTs: number): string {
  ensureDir(outDir);
  const desired = path.join(outDir, `${baseName}.${ext}`);
  if (!fs.existsSync(desired)) return desired;
  return path.join(outDir, `${baseName}-${runTs}.${ext}`);
}
function buildHtmlDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title || 'Article')}</title>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}
function buildMarkdownDocument(title: string, description: string, body: string): string {
  const lines = [`# ${title || 'Article'}`];
  if (description) lines.push(`> ${description}`);
  lines.push('', body.trim());
  return lines.join('\n');
}
function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const MODEL_ENV_MAP: Record<string, { in: string; out: string }> = {
  'gpt-4o-mini': { in: 'PRICE_GPT4O_MINI_IN', out: 'PRICE_GPT4O_MINI_OUT' },
  'gpt-4o': { in: 'PRICE_GPT4O_IN', out: 'PRICE_GPT4O_OUT' },
  'deepseek-chat': { in: 'PRICE_DEEPSEEK_CHAT_IN', out: 'PRICE_DEEPSEEK_CHAT_OUT' },
  'deepseek-coder': { in: 'PRICE_DEEPSEEK_CODER_IN', out: 'PRICE_DEEPSEEK_CODER_OUT' },
};

function resolvePrices(
  modelId?: string,
  cliIn?: string | number,
  cliOut?: string | number
): {
  in?: number;
  out?: number;
  found: boolean;
  source: 'cli' | 'model' | 'global' | 'none';
  pickedInKey?: string;
  pickedOutKey?: string;
} {
  const toNum = (v?: string | number | null) =>
    v == null || v === '' ? undefined : (Number.isFinite(+v) ? +v : undefined);

  const inArg = toNum(cliIn);
  const outArg = toNum(cliOut);
  if (inArg != null || outArg != null) {
    return { in: inArg, out: outArg, found: true, source: 'cli' };
  }

  if (modelId && MODEL_ENV_MAP[modelId]) {
    const { in: inKey, out: outKey } = MODEL_ENV_MAP[modelId];
    const inVal = toNum(process.env[inKey]);
    const outVal = toNum(process.env[outKey]);
    if (inVal != null || outVal != null) {
      return {
        in: inVal,
        out: outVal,
        found: true,
        source: 'model',
        pickedInKey: inKey,
        pickedOutKey: outKey,
      };
    }
  }

  const globalIn = toNum(process.env.PRICE_IN);
  const globalOut = toNum(process.env.PRICE_OUT);
  if (globalIn != null || globalOut != null) {
    return { in: globalIn, out: globalOut, found: true, source: 'global' };
  }

  return { found: false, source: 'none' };
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}

type SubTiming = { title: string; ms: number };
type SectionTiming = {
  heading: string;
  subheadingCount: number;
  ms: number;
  subTimings: SubTiming[];
  summaryMs?: number;
};

export async function generateArticle(options: GenerateArticleOptions): Promise<{
  article: ArticleJSON;
  files?: { json?: string; html?: string; md?: string };
}> {
  const {
    provider = 'openai',
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
    printPreview: _printPreviewDeprecated,
    printUsage: printUsageOpt,
  } = options;

  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error('keywords must be a non-empty string array.');
  }

  // For backwards compatibility: preview is now printed at the end, ignore printPreview flag.
  const printUsage = typeof printUsageOpt === 'boolean' ? printUsageOpt : verbose;

  const envDefaultModel =
    provider === 'openai' ? process.env.OPENAI_MODEL : process.env.DEEPSEEK_MODEL;
  const defaultModel = provider === 'openai' ? 'gpt-4o-mini' : 'deepseek-chat';
  const model = modelInput || envDefaultModel || defaultModel;

  const totalStart = Date.now();

  let outlineUsage: Usage = emptyUsage();
  let sectionsUsage: Usage = emptyUsage();
  let summaryUsage: Usage = emptyUsage();

  // Outline (timed)
  const outlineStart = Date.now();
  const { outline, usage: oUsage } = await generateOutlineInternal({
    provider,
    model,
    topic,
    keywords,
    wordCountRange: [minWords, maxWords],
    existingTags: existingTags.map((s) => s.toLowerCase()),
    existingCategories: existingCategories.map((s) => s.toLowerCase()),
    lang,
    verbose,
  });
  const outlineMs = Date.now() - outlineStart;
  outlineUsage = addUsage(outlineUsage, oUsage);

  // Sections (timed)
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
        provider,
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
      });
      const subMs = Date.now() - subStart;

      subBlocks.push(text);
      subTimings.push({ title: sh, ms: subMs });
      sectionsUsage = addUsage(sectionsUsage, usage);
    }

    const sectionText = subBlocks.join('\n\n');
    sectionBlocks.push(sectionText);

    let summaryMs: number | undefined;
    if (contextStrategy === 'summary') {
      const sumStart = Date.now();
      const { text: sumText, usage } = await generateSummaryInternal({
        provider,
        model,
        sectionText,
        lang,
        verbose,
      });
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
      summaryMs,
    });
  }

  // Assemble (timed)
  const assembleStart = Date.now();
  const baseArticle = assembleArticle({ meta: outline, sections: sectionBlocks });
  const assembleMs = Date.now() - assembleStart;

  // Pricing
  const resolvedPrices = resolvePrices(model, priceInPerK, priceOutPerK);
  const priceIn = resolvedPrices.in;
  const priceOut = resolvedPrices.out;

  // Usage & cost
  const totalUsage: Usage = addUsage(addUsage(outlineUsage, sectionsUsage), summaryUsage);
  const costs =
    resolvedPrices.found
      ? {
          outline: costEstimate(outlineUsage, priceIn ?? 0, priceOut ?? 0),
          sections: costEstimate(sectionsUsage, priceIn ?? 0, priceOut ?? 0),
          summaries: contextStrategy === 'summary' ? costEstimate(summaryUsage, priceIn ?? 0, priceOut ?? 0) : undefined,
          total: costEstimate(totalUsage, priceIn ?? 0, priceOut ?? 0),
          priceInPerK: priceIn ?? undefined,
          priceOutPerK: priceOut ?? undefined,
        }
      : undefined;

  const articleJSON: ArticleJSON = {
    ...baseArticle,
    provider,
    model,
    usage: {
      outline: outlineUsage,
      sections: sectionsUsage,
      summaries: contextStrategy === 'summary' ? summaryUsage : undefined,
      total: totalUsage,
    },
    cost: costs,
  };

  // Export (timed)
  const files: { json?: string; html?: string; md?: string } = {};
  let exportMs = 0;

  if (writeFiles && exportModes.length > 0) {
    const runTs = singleRunTimestamp ?? Date.now();
    const outDir = outputDir || path.join(process.cwd(), 'result');
    const defaultBase = sanitizeBaseName(baseArticle.slug || baseArticle.title || 'article');
    const baseName = sanitizeBaseName(outBaseName || defaultBase);

    const exportStart = Date.now();

    if (exportModes.includes('json')) {
      const jsonPath = uniquePath(outDir, baseName, 'json', runTs);
      fs.writeFileSync(jsonPath, JSON.stringify(articleJSON, null, 2), 'utf-8');
      files.json = jsonPath;
      if (verbose) console.log(`JSON saved to ${jsonPath}`);
    }
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

  // Final combined preview + timings table (AFTER everything)
  if (verbose) {
    console.log('\n=== Article Preview & Timings ===');
    console.log(`Title: ${outline.title}`);
    console.log(`Description: ${outline.description}`);

    const combined = new Table({
      head: ['Section', 'Subheadings', 'Duration'],
      colWidths: [30, 90, 14],
      style: { head: [], border: [] },
      wordWrap: true,
    });

    for (const t of sectionTimings) {
      const subList = (outline.outline.find(s => s.heading === t.heading)?.subheadings || [])
        .map((s) => `- ${s}`)
        .join('\n');
      combined.push([t.heading, subList || '(none)', formatDuration(t.ms)]);
    }

    console.log(combined.toString());
    console.log(
      `Outline: ${formatDuration(outlineMs)}  |  Assemble: ${formatDuration(assembleMs)}  |  Export: ${formatDuration(
        exportMs
      )}`
    );
    console.log(`Total time: ${formatDuration(totalMs)}`);
  }

  // Usage & cost (after everything)
  if (printUsage) {
    const usageTable = new Table({
      head: ['Phase', 'Prompt', 'Completion', 'Total', 'Cost'],
      colWidths: [12, 12, 12, 12, 16],
      style: { head: [], border: [] },
    });

    const outlineCost = resolvedPrices.found ? costEstimate(outlineUsage, priceIn ?? 0, priceOut ?? 0) : undefined;
    const sectionsCost = resolvedPrices.found ? costEstimate(sectionsUsage, priceIn ?? 0, priceOut ?? 0) : undefined;
    const summaryCost = resolvedPrices.found ? costEstimate(summaryUsage, priceIn ?? 0, priceOut ?? 0) : undefined;
    const totalCost =
      resolvedPrices.found
        ? (outlineCost || 0) + (sectionsCost || 0) + (summaryCost || 0)
        : undefined;

    const fmt = (n?: number) => (typeof n === 'number' ? formatUSD(n) : 'n/a');

    console.log('\n=== Usage & Cost ===');
    console.log(`Provider: ${provider}  Model: ${model}`);
    if (resolvedPrices.found) {
      console.log(
        `Pricing (per 1K tokens): input=${priceIn != null ? `$${priceIn}` : 'n/a'}  output=${priceOut != null ? `$${priceOut}` : 'n/a'}`
      );
    } else {
      console.log('Pricing (per 1K tokens): n/a (no pricing found)');
    }

    usageTable.push(
      ['Outline', `${outlineUsage.promptTokens}`, `${outlineUsage.completionTokens}`, `${outlineUsage.totalTokens}`, fmt(outlineCost)],
      ['Sections', `${sectionsUsage.promptTokens}`, `${sectionsUsage.completionTokens}`, `${sectionsUsage.totalTokens}`, fmt(sectionsCost)]
    );
    if (contextStrategy === 'summary') {
      usageTable.push(['Summaries', `${summaryUsage.promptTokens}`, `${summaryUsage.completionTokens}`, `${summaryUsage.totalTokens}`, fmt(summaryCost)]);
    }
    usageTable.push(['TOTAL', `${totalUsage.promptTokens}`, `${totalUsage.completionTokens}`, `${totalUsage.totalTokens}`, fmt(totalCost)]);
    console.log(usageTable.toString());
  }

  return { article: articleJSON, files: Object.keys(files).length ? files : undefined };
}

/** ===================== CLI wrapper ===================== */

function parseExportModes(raw?: string): ExportMode[] {
  if (!raw) return ['json'];
  const lower = raw.toLowerCase().trim();
  if (lower === 'both') return ['json', 'html'];
  if (lower === 'all') return ['json', 'html', 'md'];
  const parts = lower.split(',').map((s) => s.trim()).filter(Boolean);
  const allowed: ExportMode[] = [];
  for (const p of parts) {
    if (p === 'json' || p === 'html' || p === 'md') {
      if (!allowed.includes(p)) allowed.push(p);
    }
  }
  return allowed.length ? allowed : ['json'];
}

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  (async () => {
    const providerArg = (getArg('--provider') || 'openai').toLowerCase() as Provider;
    const modelArg =
      getArg('--model') || (providerArg === 'openai' ? process.env.OPENAI_MODEL : process.env.DEEPSEEK_MODEL);
    const topic = getArg('--topic') || 'The Future of AI in Web Development';
    const keywordsStr = getArg('--keywords') || 'AI in web development, JavaScript, SEO blog';
    const min = parseInt(getArg('--min') || '1000', 10);
    const max = parseInt(getArg('--max') || '1400', 10);
    const tagsStr = getArg('--tags') || 'javascript, web development, ai';
    const categoriesStr = getArg('--categories') || 'technology, programming';
    const styleNotes = getArg('--style') || 'helpful, concise, SEO-aware';
    const langArg = getArg('--lang') || 'en';
    const contextStrategy = (getArg('--context') || 'outline') as ContextStrategy;
    const exportModes = parseExportModes(getArg('--export'));
    const outArg = getArg('--out');
    const outDirArg = getArg('--outdir') || path.join(process.cwd(), 'result');
    const priceInArg = getArg('--price-in');
    const priceOutArg = getArg('--price-out');

    const quietFlag = process.argv.includes('--quiet');
    const verboseFlag = process.argv.includes('--verbose');
    const verbose = verboseFlag ? true : quietFlag ? false : true;

    const keywords = keywordsStr.split(',').map((s) => s.trim()).filter(Boolean);
    const existingTags = tagsStr.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
    const existingCategories = categoriesStr.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);

    await generateArticle({
      provider: providerArg,
      model: modelArg,
      topic,
      keywords,
      minWords: min,
      maxWords: max,
      existingTags,
      existingCategories,
      styleNotes,
      lang: langArg,
      contextStrategy,
      exportModes,
      outBaseName: outArg,
      outputDir: outDirArg,
      writeFiles: true,
      priceInPerK: priceInArg,
      priceOutPerK: priceOutArg,
      verbose,
    });
  })().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  });
}
