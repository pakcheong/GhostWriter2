import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { generateArticle } from '../src/article/generate-article.js';
import { installGhostwriterMocks, resetGhostwriterMocks } from '../src/testing/mocks.ts';

const outDir = path.join(process.cwd(), 'tmp-export-tests2');
if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });

installGhostwriterMocks({ providerFetch: true });
let jsonPath: string | undefined;
try {
  const { files } = await generateArticle({
    topic: 'Export Example',
    keywords: ['export'],
    model: 'gpt-4o-mini',
    exportModes: ['json', 'md', 'html'],
    writeFiles: true,
    outputDir: outDir,
    namePattern: '[timestamp]-[title]'
  });
  assert.ok(files?.json && files?.html && files?.md);
  jsonPath = files!.json!;
  assert.ok(fs.existsSync(jsonPath));
  const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  assert.ok(parsed.output && parsed.output.content && parsed.output.runtime && parsed.input);
  assert.ok(parsed.output.runtime.model.resolved);
  assert.ok(typeof parsed.output.runtime.timings.totalMs === 'number');
  const base = path.basename(jsonPath).replace(/\.json$/, '');
  assert.ok(fs.existsSync(path.join(outDir, base + '.md')));
  assert.ok(fs.existsSync(path.join(outDir, base + '.html')));
  console.log('file-export.test.ts passed');
} finally {
  resetGhostwriterMocks();
  if (fs.existsSync(outDir)) fs.rmSync(outDir, { recursive: true, force: true });
}
