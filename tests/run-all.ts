// Simple test runner to execute all test files.
import fs from 'fs';
import path from 'path';

const testsDir = path.join(process.cwd(), 'tests');
const files = fs.readdirSync(testsDir).filter(f => f.endsWith('.test.ts'));

let failed = 0;
let skipped = 0;
for (const f of files) {
  try {
    await import(path.join(testsDir, f));
  } catch (err: any) {
    if (err?.message === '__SKIP__') {
      skipped++;
      console.log('Test skipped:', f);
    } else {
      failed++;
      console.error('Test failed:', f, err);
    }
  }
}

if (failed > 0) {
  console.error(`${failed} test(s) failed. (${skipped} skipped)`);
  process.exit(1);
}
console.log(`All ${files.length - skipped} tests passed. (${skipped} skipped)`);
