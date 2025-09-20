#!/usr/bin/env node
// Moved from root src/cli.ts to align with article generation scope.
import path from 'path';
import fs from 'fs';
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
      const help = `ghostwriter article generator (moved to src/article/cli.ts)

Usage: ghostwriter [options]

Options:
  --model <model>                  Model id (env fallback)
  --topic <string>                 Article topic
  --keywords "a,b,c"               Comma list of keywords (required)
  --min <num>                      Minimum word target (default 1000)
  --max <num>                      Maximum word target (default 1400)
  --tags "t1,t2"                   Existing tags reference
  --categories "c1,c2"             Existing categories reference
  --style <notes>                  Style notes
  --lang <code>                    Language (default en)
  --context <outline|full|summary> Context strategy (default outline)
  --export <json,html,md|all>      Export formats (default json)
  --out <basename>                 Output base filename override
  --outdir <dir>                   Output directory (default ./.tmp)
  --required-headings "H1,H2"      Force outline to include these headings
  --required-subheadings "S1,S2"   Force outline to include these subheadings
  --required-phrases "p1,p2"       Require body to contain these phrases (tracked)
  --required-content-file <path>   JSON file with requiredContent[] descriptors
  --strict-required               Fail (exit 2) if required content missing or overused
  --name-pattern <pattern>         Dynamic name pattern ([timestamp],[date],[time],[slug],[title])
  --timestamp <ms>                 Fixed run timestamp (number)
  --price-in <number>              Override input price per 1K tokens
  --price-out <number>             Override output price per 1K tokens
  --quiet                          Reduce log output
  --verbose                        Force verbose output
  --help                           Show this help`;
      console.log(help + '\n');
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
    const reqHeadingsArg = getArg('--required-headings');
    const reqSubheadingsArg = getArg('--required-subheadings');
    const reqPhrasesArg = getArg('--required-phrases');
    const reqContentFile = getArg('--required-content-file');
    let requiredContent: any[] | undefined;
    if (reqContentFile) {
      try {
        const raw = fs.readFileSync(path.resolve(reqContentFile), 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) requiredContent = parsed;
        else console.warn('[warn] --required-content-file does not contain a JSON array');
      } catch (err: any) {
        console.warn('[warn] failed to load --required-content-file:', err && (err.message || String(err)));
      }
    }
    const priceInArg = getArg('--price-in');
    const priceOutArg = getArg('--price-out');
    const namePattern = getArg('--name-pattern');
    const timestampRaw = getArg('--timestamp');
    const singleRunTimestamp = timestampRaw ? parseInt(timestampRaw, 10) : undefined;
    const strictRequired = process.argv.includes('--strict-required');

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

    const result = await generateArticle({
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
      requiredOutlineHeadings: reqHeadingsArg
        ? reqHeadingsArg
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : undefined,
      requiredOutlineSubheadings: reqSubheadingsArg
        ? reqSubheadingsArg
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : undefined,
      requiredCoveragePhrases: reqPhrasesArg
        ? reqPhrasesArg
            .split(',')
            .map((s: string) => s.trim())
            .filter(Boolean)
        : undefined,
      requiredContent,
      strictRequired,
      writeFiles: true,
      priceInPerK: priceInArg,
      priceOutPerK: priceOutArg,
      // printUsage intentionally not exposed via separate flags to match GenerateArticleOptions exactly
      singleRunTimestamp,
      namePattern,
      verbose
    });
    if (strictRequired) {
      const rc = (result.article as any)?.strategy?.requiredCoverage;
      if (rc?.strictFailed) {
        console.error('[strict-required] Failure: missing or overused required content detected.');
        console.error('Missing:', rc.missing?.length ? rc.missing.join(', ') : '(none)');
        console.error('Overused:', rc.overused?.length ? rc.overused.join(', ') : '(none)');
        process.exit(2);
      }
    }
  })().catch((err) => {
    console.error(err?.message || err);
    process.exit(1);
  });
}
