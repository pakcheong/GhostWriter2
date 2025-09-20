import { assembleArticle } from '../src/article/assembly.js';
import { strict as assert } from 'assert';

const article = assembleArticle({
  meta: {
    title: 'T',
    description: 'D',
    slug: 'slug',
    outline: [],
    tags: ['A', 'A'],
    categories: ['c1', 'c1']
  },
  sections: ['Content one', 'Content two']
});

assert.equal(article.body.includes('Content one'), true);
assert.equal(article.tags.length, 1);
assert.equal(article.categories.length, 1);

console.log('assembly.test.ts passed');
