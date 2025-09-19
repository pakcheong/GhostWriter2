import 'dotenv/config';
import path from 'path';
import { autoGenerateArticlesFromTopics } from '../dist/index.js';
import { marked } from 'marked';

function getArg(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && idx < process.argv.length - 1) return process.argv[idx + 1];
  return undefined;
}

type WPTag = { id: number; name: string };
type WPCategory = { id: number; name: string };

interface PublishOptions {
  base: string;
  user: string;
  pass: string;
  status: 'publish' | 'draft' | 'pending';
  dryRun: boolean;
  delayMs: number;
  verbose: boolean;
}

function requireArg(value: string | undefined, name: string): string {
  if (!value) throw new Error(`Missing required ${name}`);
  return value;
}

async function wpGet<T = any>(base: string, auth: string, resource: string): Promise<T> {
  const res = await fetch(base + resource, { headers: { Authorization: auth } });
  if (!res.ok) throw new Error(`GET ${resource} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function wpPost<T = any>(base: string, auth: string, resource: string, body: any): Promise<T> {
  const res = await fetch(base + resource, {
    method: 'POST',
    headers: { Authorization: auth, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`POST ${resource} failed: ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

function dedupe(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of list) {
    const k = v.trim().toLowerCase();
    if (!k) continue;
    if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

async function ensureTaxonomy(base: string, auth: string, type: 'tags' | 'categories', names: string[], verbose: boolean): Promise<number[]> {
  if (!names.length) return [];
  const existing: Array<{ id: number; name: string }> = await wpGet(base, auth, `/${type}?per_page=100`);
  const ids: number[] = [];
  for (const n of dedupe(names)) {
    const found = existing.find(e => e.name.toLowerCase() === n);
    if (found) { ids.push(found.id); continue; }
    if (verbose) console.log(`[wp] creating ${type.slice(0,-1)}: ${n}`);
    const created = await wpPost(base, auth, `/${type}`, { name: n });
    ids.push(created.id);
  }
  return ids;
}

async function postExists(base: string, auth: string, slug: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/posts?slug=${encodeURIComponent(slug)}`, { headers: { Authorization: auth } });
    if (!res.ok) return false;
    const arr: any[] = await res.json();
    return Array.isArray(arr) && arr.length > 0;
  } catch { return false; }
}

async function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function publishArticles(opts: PublishOptions, articles: any[]) {
  const auth = 'Basic ' + Buffer.from(`${opts.user}:${opts.pass}`).toString('base64');
  try {
    await wpGet(opts.base, auth, '/tags?per_page=100');
    await wpGet(opts.base, auth, '/categories?per_page=100');
  } catch (e) {
    if (opts.verbose) console.warn('[wp] prefetched taxonomy failed (will still create on demand):', (e as any)?.message);
  }
  let published = 0, skipped = 0, failed = 0;
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    if (!a) continue;
    const slug: string = a.slug || a.title?.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (!slug) { if (opts.verbose) console.warn(`[skip] article index ${i} missing slug/title`); continue; }
    if (opts.dryRun) { console.log(`[DRY] Would publish: ${slug}`); skipped++; continue; }
    if (await postExists(opts.base, auth, slug)) { if (opts.verbose) console.log(`[skip] exists: ${slug}`); skipped++; continue; }
    try {
      const tagIds = await ensureTaxonomy(opts.base, auth, 'tags', a.tags || [], opts.verbose);
      const catIds = await ensureTaxonomy(opts.base, auth, 'categories', a.categories || [], opts.verbose);
      const excerpt = a.description || a.body?.slice(0, 160) || '';
  const md = a.body || '';
  // Convert markdown to HTML for WordPress content field
  const html = marked.parse(md, { async: false }) as string;
      const res = await wpPost(opts.base, auth, '/posts', { title: a.title, slug, excerpt, content: html, tags: tagIds, categories: catIds, status: opts.status });
      if (opts.verbose) console.log(`[ok] ${slug} -> ${res.id}`); published++; }
    catch (e) { console.error(`[fail] ${slug}:`, (e as any)?.message || e); failed++; }
    if (opts.delayMs > 0 && i < articles.length - 1) await sleep(opts.delayMs);
  }
  console.log(`Summary: published=${published} skipped=${skipped} failed=${failed}`);
}

async function main() {
  const domain = getArg('--domain');
  if (!domain) throw new Error('Missing --domain');
  const tModel = getArg('--t-model') || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const aModel = getArg('--a-model') || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const countRaw = getArg('--count');
  const count = typeof countRaw === 'string' ? parseInt(countRaw, 10) : undefined;
  const concurrencyRaw = getArg('--concurrency');
  const concurrency = concurrencyRaw ? Math.max(1, parseInt(concurrencyRaw, 10)) : undefined;
  const minWords = parseInt(getArg('--min') || '1000', 10);
  const maxWords = parseInt(getArg('--max') || '1400', 10);
  const contextStrategy = (getArg('--context') || 'outline') as any;
  const exportRaw = getArg('--export');
  const exportModes = (() => { if (!exportRaw) return ['json']; if (exportRaw.toLowerCase().trim() === 'all') return ['json','html','md']; return exportRaw.split(',').map((s:string)=>s.trim()).filter((x:string)=>x==='json'||x==='html'||x==='md'); })();
  const lang = getArg('--lang');
  const includeKeywords = getArg('--include')?.split(',').map((s:string)=>s.trim()).filter(Boolean);
  const excludeKeywords = getArg('--exclude')?.split(',').map((s:string)=>s.trim()).filter(Boolean);
  const wpBase = requireArg(getArg('--wp-base') || process.env.WP_BASE_URL, '--wp-base/WP_BASE_URL');
  const wpUser = requireArg(getArg('--wp-user') || process.env.WP_USERNAME, '--wp-user/WP_USERNAME');
  const wpPass = requireArg(getArg('--wp-pass') || process.env.WP_PASSWORD, '--wp-pass/WP_PASSWORD');
  const status = (getArg('--status') as any) || 'publish';
  const delayMs = parseInt(getArg('--delay-ms') || '0', 10);
  const dryRun = process.argv.includes('--dry-run');
  const verbose = process.argv.includes('--verbose');
  if (verbose) console.log('[run] fetching existing WP taxonomy to seed generation');
  const auth = 'Basic ' + Buffer.from(`${wpUser}:${wpPass}`).toString('base64');
  let existingTags: string[] = []; let existingCategories: string[] = [];
  try { const wpTags = await wpGet<WPTag[]>(wpBase, auth, '/tags?per_page=100'); existingTags = wpTags.map(t=>t.name.toLowerCase()); const wpCats = await wpGet<WPCategory[]>(wpBase, auth, '/categories?per_page=100'); existingCategories = wpCats.map(c=>c.name.toLowerCase()); } catch (e) { console.warn('[warn] taxonomy prefetch failed:', (e as any)?.message); }
  const autoRes = await autoGenerateArticlesFromTopics({ topics: { domain, model: tModel, lang, includeKeywords: includeKeywords?.length?includeKeywords:undefined, excludeKeywords: excludeKeywords?.length?excludeKeywords:undefined, verbose }, article: { model: aModel, minWords, maxWords, contextStrategy, exportModes, existingTags, existingCategories, lang, writeFiles: true, outputDir: path.join(process.cwd(),'result'), verbose } as any, count, concurrency, verbose });
  if (verbose) console.log('[run] generation complete, publishing to WordPress...');
  await publishArticles({ base: wpBase, user: wpUser, pass: wpPass, status, dryRun, delayMs, verbose }, autoRes.articles.filter(Boolean));
}

main().catch(err => { console.error(err?.message || err); process.exit(1); });
