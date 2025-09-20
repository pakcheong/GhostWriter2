#!/usr/bin/env node
// Moved from root src/cli.ts to align with article generation scope.
import path from 'path';
import { pathToFileURL } from 'url';
import { generateArticle } from '../article/generate-article.js';
import { getArg } from '../utils.js';
import type { ContextStrategy, ExportMode } from '../types.js';

function parseExportModes(raw?: string): ExportMode[] {
  if (!raw) return ['json'];
  const lower = raw.toLowerCase().trim();
  if (lower === 'all') return ['json', 'html', 'md'];
  const parts = lower
    .split(',')
    .map((s: string) => s.trim())
    .filter(Boolean);
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
    if (process.argv.includes('--help') || process.argv.includes('-h')) {
      const help =
        'ghostwriter article generator (moved to src/article/cli.ts)\n\n' +
        'Usage: ghostwriter [options]\n\n' +
        'Options:\n' +
        '  --model <model>                  Model id (env fallback)\n' +
        '  --topic <string>                 Article topic\n' +
        '  --keywords "a,b,c"               Comma list of keywords (required)\n' +
        '  --min <num>                      Minimum word target (default 1000)\n' +
        '  --max <num>                      Maximum word target (default 1400)\n' +
        '  --tags "t1,t2"                   Existing tags reference\n' +
        '  --categories "c1,c2"             Existing categories reference\n' +
        '  --style <notes>                  Style notes\n' +
        '  --lang <code>                    Language (default en)\n' +
        '  --context <outline|full|summary> Context strategy (default outline)\n' +
        '  --export <json,html,md|all>      Export formats (default json)\n' +
        '  --out <basename>                 Output base filename override\n' +
        '  --outdir <dir>                   Output directory (default ./.tmp)\n' +
        '  --name-pattern <pattern>         Dynamic name pattern ([timestamp],[date],[time],[slug],[title])\n' +
        '  --timestamp <ms>                 Fixed run timestamp (number)\n' +
        '  --price-in <number>              Override input price per 1K tokens\n' +
        '  --price-out <number>             Override output price per 1K tokens\n' +
        '  --quiet                          Reduce log output\n' +
        '  --verbose                        Force verbose output\n' +
        '  --help                           Show this help\n';
      console.log(help);
      process.exit(0);
    }
    const modelArg = getArg('--model') || process.env.OPENAI_MODEL || process.env.DEEPSEEK_MODEL;
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
    const outDirArg = getArg('--outdir') || path.join(process.cwd(), '.tmp');
    const priceInArg = getArg('--price-in');
    const priceOutArg = getArg('--price-out');
    const namePattern = getArg('--name-pattern');
    const timestampRaw = getArg('--timestamp');
    const singleRunTimestamp = timestampRaw ? parseInt(timestampRaw, 10) : undefined;

    const quietFlag = process.argv.includes('--quiet');
    const verboseFlag = process.argv.includes('--verbose');
    const verbose = verboseFlag ? true : quietFlag ? false : true;

    const keywords = keywordsStr
      .split(',')
      .map((s: string) => s.trim())
      .filter(Boolean);
    const existingTags = tagsStr
      .split(',')
      .map((s: string) => s.trim().toLowerCase())
      .filter(Boolean);
    const existingCategories = categoriesStr
      .split(',')
      .map((s: string) => s.trim().toLowerCase())
      .filter(Boolean);

    await generateArticle({
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
      // printUsage intentionally not exposed via separate flags to match GenerateArticleOptions exactly
      singleRunTimestamp,
      namePattern,
      verbose
    });
  })().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  });
}
