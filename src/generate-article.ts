// scripts/generate-article.ts
// Library + CLI. Prints the combined "preview + timings" table only AFTER all work is done.

import { generateText as realGenerateText } from 'ai';
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
  costEstimate,
} from './utils.js';
import type { ContextStrategy, OutlineItem, OutlineResult, ArticleJSON, GenerateArticleOptions, SectionTiming, SubTiming, ArticleTimings } from './types.js';
import { buildOutlinePrompt, buildSectionPrompt, buildSummaryPrompt } from './prompts.js';
import { getClientForProvider } from './model-config.js';

// Explicit model→provider mapping. Add entries as needed.
// Added 'lmstudio' for local LM Studio OpenAI-compatible server models.
const MODEL_PROVIDER_MAP: Record<string, 'openai' | 'deepseek' | 'lmstudio'> = {
  'gpt-4o-mini': 'openai',
  'gpt-4o': 'openai',
  'gpt-4.1': 'openai',
  'gpt-4.1-mini': 'openai',
  'o3-mini': 'openai',
  'text-davinci-003': 'openai',
  'deepseek-chat': 'deepseek',
  'deepseek-reasoner': 'deepseek',
  // Common LM Studio model aliases (user can adjust):
  'llama-3': 'lmstudio',
  'llama-3.1': 'lmstudio',
  'qwen2': 'lmstudio',
  'phi-3': 'lmstudio',
  'mistral': 'lmstudio',
  'openai/gpt-oss-20b': 'lmstudio',
};

function resolveProviderForModel(model: string): 'openai' | 'deepseek' | 'lmstudio' {
  const key = model.toLowerCase();
  if (MODEL_PROVIDER_MAP[key]) return MODEL_PROVIDER_MAP[key];
  throw new Error(`Unknown model '${model}'. Please add it to MODEL_PROVIDER_MAP.`);
}
import { extractUsage } from './usage.js';
import { resolvePrices } from './pricing.js';
import { assembleArticle, sanitizeBaseName, uniquePath, buildHtmlDocument, buildMarkdownDocument, formatDuration } from './assembly.js';
import { dedupeOutline, computeDuplicateRatio } from './dedupe.js';

dotenv.config({ path: path.join(process.cwd(), '.env') });

// Removed in favor of modularized helpers.
// Allow tests to inject a mock generateText implementation to avoid real API calls.
let _generateTextImpl: typeof realGenerateText | ((args: any) => Promise<any>) = realGenerateText;
export function __setGenerateTextImpl(fn: typeof realGenerateText | ((args: any) => Promise<any>)) {
  _generateTextImpl = fn;
}

// Track whether we've performed a one-time warmup call for LM Studio to pre-load model.
let _lmstudioWarmed = false;

async function safeGenerateText(args: any, context: { provider: string; model: string; phase: string }) {
  try {
    // Custom Deepseek compatibility: the ai SDK's responses endpoint may 404; fall back to direct chat/completions.
    if (context.provider === 'deepseek') {
      const apiKey = process.env.DEEPSEEK_API_KEY;
      if (!apiKey) throw new Error('Missing DEEPSEEK_API_KEY.');
      let base = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1';
      if (!/\/v\d+$/.test(base)) base = base.replace(/\/$/, '') + '/v1';

      const url = base.replace(/\/$/, '') + '/chat/completions';
      const messages = args.messages
        ? args.messages.map((m: any) => ({ role: m.role, content: m.content }))
        : [{ role: 'user', content: args.prompt }];
      const body: any = {
        model: context.model,
        messages,
      };
      // Pass through basic sampling params if present.
      if (args.temperature != null) body.temperature = args.temperature;
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Deepseek API error ${resp.status}: ${txt}`);
      }
      const json: any = await resp.json();
      const content = json.choices?.[0]?.message?.content || '';
      const usage = json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined;
      return { text: content, usage };
    }
    if (context.provider === 'lmstudio') {
      // Many LM Studio builds expose OpenAI-style /chat/completions but may not support the new /responses endpoint shape.
      // Fallback to direct fetch similar to deepseek path.
      let base = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';
      if (!/\/v\d+$/.test(base)) base = base.replace(/\/$/, '') + '/v1';
      const url = base.replace(/\/$/, '') + '/chat/completions';

      // Optional warmup (load model to RAM) to reduce initial headers delay.
      if (!_lmstudioWarmed && process.env.LMSTUDIO_WARM !== '0') {
        try {
          const warmResp = await fetch(base.replace(/\/$/, '') + '/models', { method: 'GET' });
          if (warmResp.ok) _lmstudioWarmed = true;
        } catch {/* ignore warm errors */}
      }

      // Normalize messages.
      const messages = args.messages
        ? args.messages.map((m: any) => ({ role: m.role, content: typeof m.content === 'string' ? m.content : (Array.isArray(m.content) ? m.content.map((c: any) => c?.text || JSON.stringify(c)).join('\n') : JSON.stringify(m.content)) }))
        : [{ role: 'user', content: args.prompt }];

      const body: any = { model: context.model, messages };
      if (args.temperature != null) body.temperature = args.temperature;

      const wantStream = process.env.LMSTUDIO_STREAM === '1'; // opt-in streaming only (safer default for tests)
      if (wantStream) body.stream = true;

  const timeoutMs = parseInt(process.env.LMSTUDIO_TIMEOUT_MS || '900000', 10); // default 15m
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let resp: Response;
      try {
        resp = await fetch(url, {
          method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal,
        });
      } catch (e: any) {
        clearTimeout(timer);
        if (e?.name === 'AbortError') {
          throw new Error(`LM Studio request aborted after ${timeoutMs}ms. You can raise LMSTUDIO_TIMEOUT_MS or enable streaming (LMSTUDIO_STREAM=1).`);
        }
        throw e;
      }
      clearTimeout(timer);
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        throw new Error(`LM Studio API error ${resp.status}: ${txt}`);
      }

      if (wantStream) {
        // SSE-like stream with lines beginning 'data:'. Accumulate delta content.
        const reader = resp.body?.getReader();
        if (!reader) {
          // Fallback to non-stream parse.
          const fallback = await resp.text();
          try {
            const parsed = JSON.parse(fallback);
            const content = parsed.choices?.[0]?.message?.content || fallback;
            return { text: content, usage: undefined };
          } catch {
            return { text: fallback, usage: undefined };
          }
        }
        const decoder = new TextDecoder();
        let buf = '';
        let assembled = '';
        while (true) {
          const { done, value } = await reader.read();
            if (done) break;
            buf += decoder.decode(value, { stream: true });
            const lines = buf.split(/\r?\n/);
            buf = lines.pop() || '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;
              if (trimmed.startsWith('data:')) {
                const jsonStr = trimmed.slice(5).trim();
                if (jsonStr === '[DONE]') continue;
                try {
                  const deltaObj = JSON.parse(jsonStr);
                  const delta = deltaObj.choices?.[0]?.delta?.content || deltaObj.choices?.[0]?.message?.content;
                  if (delta) assembled += delta;
                } catch {/* ignore parse errors */}
              } else {
                // Raw text fallback.
                assembled += trimmed + '\n';
              }
            }
        }
        return { text: assembled.trim(), usage: undefined };
      }

      // Non-stream path: parse JSON fully.
      const json: any = await resp.json().catch(async () => ({ raw: await resp.text() }));
      const content = json.choices?.[0]?.message?.content || json.raw || '';
      const usage = json.usage
        ? {
            promptTokens: json.usage.prompt_tokens,
            completionTokens: json.usage.completion_tokens,
            totalTokens: json.usage.total_tokens,
          }
        : undefined;
      return { text: content, usage };
    }
    return await _generateTextImpl(args);
  } catch (err: any) {
    const status = err?.statusCode || err?.status || err?.code;
    if (status === 404) {
      const hints: string[] = [
        'Received 404 from model API.',
        `Phase: ${context.phase}`,
        `Provider: ${context.provider}`,
        `Model: ${context.model}`,
      ];
      if (context.provider === 'deepseek') {
        hints.push(
          'Hints: Ensure base URL includes /v1 (e.g. https://api.deepseek.com/v1).',
          "Confirm model name (e.g. 'deepseek-chat').",
          'Unset OPENAI_MODEL if it incorrectly overrides Deepseek model.',
          'Set DEEPSEEK_MODEL or pass model explicitly.'
        );
      } else if (context.provider === 'lmstudio') {
        hints.push(
          'Hints: Ensure LM Studio server running (default http://localhost:1234).',
          'Set LMSTUDIO_BASE_URL if using a different port/path.',
          'Confirm the model name matches one shown in LM Studio UI.'
        );
      } else if (context.provider === 'openai') {
        hints.push('Hints: Using an OpenAI provider; model should start with gpt- or o.*');
      }
      const guidance = hints.join('\n - ');
      err.message = `${err.message || '404 Not Found'}\n${guidance}`;
    }
    throw err;
  }
}

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
    lang: opts.lang,
  });

  const t0 = Date.now();
  const res = await safeGenerateText(
    {
      model: openai(opts.model),
      prompt: promptText,
    },
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
  const res = await safeGenerateText(
    {
      model: openai(opts.model),
      messages: contextMessages,
    },
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
    {
      model: openai(opts.model),
      prompt,
    },
    { provider, model: opts.model, phase: 'summary' }
  );
  const ms = Date.now() - t0;

  const usage = extractUsage(res, opts.model, prompt, res.text);
  return { text: res.text.trim(), usage, modelId: opts.model, ms };
}

// Pricing, assembly, timing helpers imported.

export async function generateArticle(options: GenerateArticleOptions): Promise<{
  article: ArticleJSON;
  files?: { json?: string; html?: string; md?: string };
}> {
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
    printPreview: _printPreviewDeprecated,
    printUsage: printUsageOpt,
  } = options;

  if (!Array.isArray(keywords) || keywords.length === 0) {
    throw new Error('keywords must be a non-empty string array.');
  }

  // For backwards compatibility: preview is now printed at the end, ignore printPreview flag.
  const printUsage = typeof printUsageOpt === 'boolean' ? printUsageOpt : verbose;

  const envModel = process.env.OPENAI_MODEL || process.env.DEEPSEEK_MODEL || process.env.LMSTUDIO_MODEL;
  const model = modelInput || envModel || 'gpt-4o-mini';
  const provider = resolveProviderForModel(model);

  const totalStart = Date.now();

  let outlineUsage: Usage = emptyUsage();
  let sectionsUsage: Usage = emptyUsage();
  let summaryUsage: Usage = emptyUsage();

  // Outline (timed) with duplicate detection + single retry if heavy duplication
  const duplicateWarnThreshold = 0.2; // >20% collapsed triggers warning
  let outline: OutlineResult;
  let outlineMs: number;
  let duplicateRatio = 0;
  let outlineAttempts = 0;
  const maxOutlineAttempts = 2;
  // rawOutline variable removed (was unused after dedupe stats computation)
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
    });
    const deduped = dedupeOutline(raw, { verbose });
    duplicateRatio = computeDuplicateRatio(raw, deduped);
    outline = deduped;
    outlineMs = Date.now() - outlineStart;
    outlineUsage = addUsage(outlineUsage, oUsage);
    if (duplicateRatio <= duplicateWarnThreshold || outlineAttempts >= maxOutlineAttempts) break;
    if (verbose) console.log(`[outline] High duplicate ratio ${(duplicateRatio * 100).toFixed(1)}% -> retrying once...`);
  }

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
      // Strip any accidental duplicate section H2 emitted by model.
      const cleaned = text
        .replace(new RegExp(`^## +${sec.heading}\n+`, 'i'), '') // leading duplicate
        .replace(new RegExp(`\n## +${sec.heading}\n`, 'gi'), '\n'); // interior duplicates
      subBlocks.push(cleaned.trim());
      subTimings.push({ title: sh, ms: subMs });
      sectionsUsage = addUsage(sectionsUsage, usage);
    }
    // Insert single H2 heading followed by all subsection blocks.
    const sectionText = ['## ' + sec.heading, ...subBlocks].join('\n\n');
    sectionBlocks.push(sectionText);

    let summaryMs: number | undefined;
    if (contextStrategy === 'summary') {
      const sumStart = Date.now();
      const { text: sumText, usage } = await generateSummaryInternal({
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

  const status: ArticleJSON['status'] = duplicateRatio > duplicateWarnThreshold ? 'warning' : 'success';
  // timings object will be populated after totalMs is computed (below)
  if (status === 'warning' && verbose) {
    console.log(`[status] Outline duplicate ratio ${(duplicateRatio * 100).toFixed(1)}% exceeded ${(duplicateWarnThreshold*100).toFixed(0)}% threshold.`);
  }

  // Export (timed, excluding JSON until after articleJSON built)
  const files: { json?: string; html?: string; md?: string } = {};
  let exportMs = 0;
  const runTs = singleRunTimestamp ?? Date.now();
  const outDir = outputDir || path.join(process.cwd(), 'result');
  const defaultBase = sanitizeBaseName(baseArticle.slug || baseArticle.title || 'article');
  let baseName: string;
  if (options.namePattern) {
    const ts = runTs;
    const dateObj = new Date(ts);
    const pad = (n: number, len = 2) => n.toString().padStart(len, '0');
    const dateStr = `${dateObj.getFullYear()}${pad(dateObj.getMonth() + 1)}${pad(dateObj.getDate())}`;
    const timeStr = `${pad(dateObj.getHours())}${pad(dateObj.getMinutes())}${pad(dateObj.getSeconds())}`;
    const rawPattern = options.namePattern;
    const replaced = rawPattern
      .replaceAll('[timestamp]', String(ts))
      .replaceAll('[date]', dateStr)
      .replaceAll('[time]', timeStr)
      .replaceAll('[slug]', baseArticle.slug || defaultBase)
      .replaceAll('[title]', baseArticle.slug || defaultBase);
    baseName = sanitizeBaseName(replaced);
  } else {
    baseName = sanitizeBaseName(outBaseName || defaultBase);
  }
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
    exportMs = Date.now() - exportStart; // currently excludes JSON writing
  }

  const totalMs = Date.now() - totalStart; // includes export work above

  const endTimeNow = Date.now();
  let computedEnd = endTimeNow;
  if (computedEnd < totalStart) {
    // System clock adjustment detected; fallback to monotonic style reconstruction.
    computedEnd = totalStart + totalMs;
  }
  const timings: ArticleTimings = {
    totalMs,
    outlineMs: outlineMs!,
    assembleMs,
    exportMs,
    outlineAttempts,
    startTime: totalStart,
    endTime: computedEnd,
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
      total: totalUsage,
    },
    cost: costs,
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
    console.log(`Provider (mapped): ${provider}  Model: ${model}`);
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
