import { generateArticle } from '../src/article/generate-article.js';
import { __setGenerateTextImpl } from '../src/article/generate-article.js';

__setGenerateTextImpl(async (args: any) => {
  const prompt = args.prompt || JSON.stringify(args.messages);
  let text: string;
  if (prompt.includes('outline') || prompt.includes('{"topic"')) {
    text = JSON.stringify({
      title: 'Test Title',
      description: 'Desc',
      slug: 'test-title',
      tags: ['tag1'],
      categories: ['cat1'],
      outline: [
        { heading: 'Section A', subheadings: ['Sub A1', 'Sub A2'] },
        { heading: 'Section B', subheadings: ['Sub B1'] }
      ]
    });
  } else if (prompt.toLowerCase().includes('summar')) {
    text = 'Short summary.';
  } else {
    text = 'Content block with **bold** and [image]desc[/image].';
  }
  return { text, usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 } };
});

let captured: any = null;
await generateArticle({
  model: 'gpt-4o-mini',
  topic: 'Test',
  keywords: ['k1'],
  minWords: 10,
  maxWords: 20,
  existingTags: ['tag1'],
  existingCategories: ['cat1'],
  styleNotes: 'test',
  lang: 'en',
  contextStrategy: 'summary',
  exportModes: [],
  writeFiles: false,
  verbose: false,
  onArticle: (p: any) => {
    captured = p;
  }
});

if (!captured) throw new Error('onArticle not invoked');
const art = captured.output || captured; // forward/back compatibility
if (art.provider) throw new Error('provider field should be removed');
if (!art.timings) throw new Error('timings missing');
if (!Array.isArray(art.sectionTimings) || art.sectionTimings.length !== 2)
  throw new Error('sectionTimings mismatch');
if (art.status !== 'success') throw new Error('status unexpected');

// New wrapper assertions
if (!captured.input) throw new Error('input block missing');
if (captured.input.topic !== 'Test') throw new Error('input.topic mismatch');
if (captured.input.modelResolved !== 'gpt-4o-mini') throw new Error('modelResolved mismatch');
if (!captured.meta) throw new Error('meta block missing');
if (typeof captured.meta.runTimestamp !== 'number') throw new Error('meta.runTimestamp missing');
if (captured.meta.sectionCount !== 2) throw new Error('meta.sectionCount mismatch');
if (typeof captured.meta.timingsSummary.totalMs !== 'number')
  throw new Error('timingsSummary.totalMs missing');
console.log('callback.test.ts passed');
