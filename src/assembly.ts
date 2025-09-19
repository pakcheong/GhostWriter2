import fs from 'fs';
import path from 'path';
import { sanitizeMarkdown } from './utils.js';
import type { ArticleBase, OutlineResult } from './types.js';

export function assembleArticle(params: { meta: OutlineResult; sections: string[] }): ArticleBase {
  return {
    title: params.meta.title,
    description: params.meta.description,
    body: params.sections.map(sanitizeMarkdown).join('\n\n'),
    tags: Array.from(new Set(params.meta.tags || [])),
    categories: Array.from(new Set(params.meta.categories || [])),
    slug: params.meta.slug,
  };
}

export function ensureDir(outDir: string): string {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  return outDir;
}
export function sanitizeBaseName(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9._-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^[-.]+|[-.]+$/g, '') || 'article'
  );
}
export function uniquePath(
  outDir: string,
  baseName: string,
  ext: 'json' | 'html' | 'md',
  runTs: number
): string {
  ensureDir(outDir);
  const desired = path.join(outDir, `${baseName}.${ext}`);
  if (!fs.existsSync(desired)) return desired;
  return path.join(outDir, `${baseName}-${runTs}.${ext}`);
}
export function buildHtmlDocument(title: string, bodyHtml: string): string {
  return `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8" />\n<meta name="viewport" content="width=device-width, initial-scale=1" />\n<title>${escapeHtml(title || 'Article')}</title>\n</head>\n<body>\n${bodyHtml}\n</body>\n</html>`;
}
export function buildMarkdownDocument(title: string, description: string, body: string): string {
  const lines = [`# ${title || 'Article'}`];
  if (description) lines.push(`> ${description}`);
  lines.push('', body.trim());
  return lines.join('\n');
}
export function escapeHtml(s: string) {
  return s
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}m ${s}s`;
}
