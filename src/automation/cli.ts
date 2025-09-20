#!/usr/bin/env node
// Automation CLI: generate topics then articles using autoGenerateArticlesFromTopics
import { pathToFileURL } from 'url';
import path from 'path';
import { autoGenerateArticlesFromTopics } from './auto-generate.js';
import { getArg } from '../utils.js';

function parseList(val?: string): string[] | undefined {
  if (!val) return undefined;
  return val
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
}

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  (async () => {
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      const help =
        'ghostwriter automation (topics + multi-article)\n\n' +
        'Usage: ghostwriter-auto [options]\n\n' +
        'Topic Generation Options:\n' +
        '  --domain <string>                Domain / niche focus (required)\n' +
        '  --t-model <model>                Topics model (fallback to OPENAI_MODEL)\n' +
        '  --t-limit <n>                    Provisional topics limit (default heuristics)\n' +
        '  --lang <code>                    Language for topics & articles\n' +
        '  --include "k1,k2"               Include if contains ANY keyword\n' +
        '  --exclude "k1,k2"               Exclude if contains ANY keyword\n' +
        '  --include-regex <pattern>        Keep only titles matching regex\n' +
        '  --exclude-regex <pattern>        Drop titles matching regex\n' +
        '\nArticle Generation Options:\n' +
        '  --a-model <model>                Article model (fallback env)\n' +
        '  --min <num>                      Min words (default 1000)\n' +
        '  --max <num>                      Max words (default 1400)\n' +
        '  --context <outline|full|summary> Context strategy (default outline)\n' +
        '  --export <json,html,md|all>      Export formats (default json)\n' +
        '  --outdir <dir>                   Output directory (default ./result)\n' +
        '  --tags "t1,t2"                   Existing tags\n' +
        '  --categories "c1,c2"             Existing categories\n' +
        '  --style <notes>                  Style notes\n' +
        '  --name-pattern <pattern>         Dynamic name pattern ([timestamp] etc)\n' +
        '\nAutomation Controls:\n' +
        '  --count <n|-1>                   Number of articles (omit/-1 = all topics)\n' +
        '  --concurrency <n>                Concurrent article generations (default 2)\n' +
        '\nPricing & Verbosity:\n' +
        '  --price-in <number>              Override input price / 1K tokens\n' +
        '  --price-out <number>             Override output price / 1K tokens\n' +
        '  --quiet                          Reduce logging\n' +
        '  --verbose                        Verbose logging\n' +
        '  --help                           Show this help\n';
      console.log(help);
      process.exit(0);
    }
    const domain = getArg('--domain');
    if (!domain) {
      console.error('Error: --domain is required');
      process.exit(1);
    }

    // Topic opts
    const tModel = getArg('--t-model') || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const tLimitRaw = getArg('--t-limit');
    const tLimit = tLimitRaw ? Math.max(1, parseInt(tLimitRaw, 10)) : undefined;
    const lang = getArg('--lang');
    const includeKeywords = parseList(getArg('--include'));
    const excludeKeywords = parseList(getArg('--exclude'));
    const includeRegexRaw = getArg('--include-regex');
    const excludeRegexRaw = getArg('--exclude-regex');
    let includeRegex: RegExp | string | undefined;
    if (includeRegexRaw) {
      try {
        includeRegex = new RegExp(includeRegexRaw, 'i');
      } catch {
        console.warn('[auto-cli] invalid include-regex ignored');
      }
    }
    let excludeRegex: RegExp | string | undefined;
    if (excludeRegexRaw) {
      try {
        excludeRegex = new RegExp(excludeRegexRaw, 'i');
      } catch {
        console.warn('[auto-cli] invalid exclude-regex ignored');
      }
    }

    // Article opts
    const aModel = getArg('--a-model') || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const minWords = parseInt(getArg('--min') || '1000', 10);
    const maxWords = parseInt(getArg('--max') || '1400', 10);
    const contextStrategy = (getArg('--context') || 'outline') as any;
    const exportRaw = getArg('--export');
    const exportModes = (() => {
      if (!exportRaw) return ['json'];
      if (exportRaw.toLowerCase().trim() === 'all') return ['json', 'html', 'md'];
      return exportRaw
        .split(',')
        .map((s: string) => s.trim())
        .filter((x: string) => x === 'json' || x === 'html' || x === 'md');
    })();
    const outDir = getArg('--outdir') || path.join(process.cwd(), 'result');
    const tags = parseList(getArg('--tags'))?.map((s) => s.toLowerCase());
    const categories = parseList(getArg('--categories'))?.map((s) => s.toLowerCase());
    const styleNotes = getArg('--style') || 'helpful, concise, SEO-aware';
    const namePattern = getArg('--name-pattern');

    // Automation controls
    const countRaw = getArg('--count');
    const count = typeof countRaw === 'string' ? parseInt(countRaw, 10) : undefined;
    const concurrencyRaw = getArg('--concurrency');
    const concurrency = concurrencyRaw ? Math.max(1, parseInt(concurrencyRaw, 10)) : undefined;

    // Pricing / verbosity
    const priceInPerK = getArg('--price-in');
    const priceOutPerK = getArg('--price-out');
    const quiet = process.argv.includes('--quiet');
    const verbose = process.argv.includes('--verbose') ? true : quiet ? false : true;

    const res = await autoGenerateArticlesFromTopics({
      topics: {
        domain,
        model: tModel,
        limit: tLimit,
        lang,
        includeKeywords,
        excludeKeywords,
        includeRegex,
        excludeRegex,
        priceInPerK,
        priceOutPerK,
        verbose
      },
      article: {
        model: aModel,
        minWords,
        maxWords,
        contextStrategy,
        exportModes,
        outputDir: outDir,
        writeFiles: true,
        existingTags: tags,
        existingCategories: categories,
        styleNotes,
        namePattern,
        verbose
      } as any,
      count,
      concurrency,
      verbose
    });

    if (!verbose) {
      console.log('\nPicked Topics & Article Slugs:');
      res.articles.forEach((a, i) => console.log(`${i + 1}. ${a.slug}`));
    } else {
      console.log(`\n[automation-cli] Articles generated: ${res.articles.length}`);
    }
  })().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  });
}
