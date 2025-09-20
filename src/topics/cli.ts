#!/usr/bin/env node
// CLI for topics generation (mirrors style of article CLI)
import { pathToFileURL } from 'url';
import { generateTopics } from './generate-topics.js';
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
        'ghostwriter topics generator\n\n' +
        'Usage: ghostwriter-topics [options]\n\n' +
        'Options:\n' +
        '  --domain <string>                Domain or niche focus (required)\n' +
        '  --model <model>                  Model id (env fallback)\n' +
        '  --limit <n>                      Number of final topics (default 8)\n' +
        '  --lang <code>                    Language for titles/rationale\n' +
        '  --include "k1,k2"               Include if contains ANY (case-insensitive)\n' +
        '  --exclude "k1,k2"               Exclude if contains ANY\n' +
        '  --include-regex <pattern>        Keep only titles matching regex (JS style)\n' +
        '  --exclude-regex <pattern>        Drop titles matching regex\n' +
        '  --price-in <number>              Override input price per 1K tokens\n' +
        '  --price-out <number>             Override output price per 1K tokens\n' +
        '  --usage                          Force usage table output\n' +
        '  --quiet                          Reduce logs (overrides --usage unless verbose)\n' +
        '  --verbose                        Verbose logging\n' +
        '  --help                           Show this help\n';
      console.log(help);
      process.exit(0);
    }
    const domain = getArg('--domain') || getArg('--topic'); // fallback alias
    if (!domain) {
      console.error('Error: --domain is required');
      process.exit(1);
    }
    const model = getArg('--model') || process.env.OPENAI_MODEL || 'gpt-4o-mini';
    const limitStr = getArg('--limit');
    const limit = limitStr ? Math.max(1, parseInt(limitStr, 10)) : undefined;
    const lang = getArg('--lang');
    const includeKeywords = parseList(getArg('--include'));
    const excludeKeywords = parseList(getArg('--exclude'));
    const includeRegexRaw = getArg('--include-regex');
    const excludeRegexRaw = getArg('--exclude-regex');
    const priceInPerK = getArg('--price-in');
    const priceOutPerK = getArg('--price-out');

    const quiet = process.argv.includes('--quiet');
    const verbose = process.argv.includes('--verbose') ? true : quiet ? false : true;
    const forceUsage = process.argv.includes('--usage');

    let includeRegex: RegExp | string | undefined;
    if (includeRegexRaw) {
      try {
        includeRegex = new RegExp(includeRegexRaw, 'i');
      } catch {
        console.warn('[topics-cli] invalid include-regex ignored');
      }
    }
    let excludeRegex: RegExp | string | undefined;
    if (excludeRegexRaw) {
      try {
        excludeRegex = new RegExp(excludeRegexRaw, 'i');
      } catch {
        console.warn('[topics-cli] invalid exclude-regex ignored');
      }
    }

    const res = await generateTopics({
      domain,
      model,
      limit,
      lang,
      includeKeywords,
      excludeKeywords,
      includeRegex,
      excludeRegex,
      priceInPerK,
      priceOutPerK,
      verbose,
      printUsage: forceUsage ? true : undefined
    });

    if (!verbose) {
      const {
        output: { content }
      } = res as any;
      console.log('\nSelected Topic:');
      if (content.selectedIndex >= 0) console.log(' * ' + content.topics[content.selectedIndex].title);
      else console.log(' (none)');
      console.log('\nTopics:');
      content.topics.forEach((t: any, i: number) => console.log(`${i + 1}. ${t.title}`));
    }
  })().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  });
}
