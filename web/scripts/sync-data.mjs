// Copies the canonical game-data snapshot from ../../data into public/data
// so it ships as a static asset. data/ stays the single source of truth;
// run this (via npm run sync-data, or automatically before build/start)
// whenever the source JSON changes.
import { cpSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sourceDir = join(__dirname, '..', '..', 'data');
const targetDir = join(__dirname, '..', 'public', 'data');

mkdirSync(targetDir, { recursive: true });

const jsonFiles = readdirSync(sourceDir).filter((f) => f.endsWith('.json'));
const jsonFileSet = new Set(jsonFiles);

// Mirror, not just copy — remove any stale target file whose source was deleted/renamed.
for (const existing of readdirSync(targetDir)) {
  if (existing.endsWith('.json') && !jsonFileSet.has(existing)) {
    rmSync(join(targetDir, existing));
  }
}

for (const file of jsonFiles) {
  cpSync(join(sourceDir, file), join(targetDir, file));
}

console.log(`Synced ${jsonFiles.length} data file(s) to public/data/`);
