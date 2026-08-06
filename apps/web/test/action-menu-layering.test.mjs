import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');

test('kolom aksi yang terbuka berada di atas kolom aksi baris berikutnya', () => {
  assert.match(css, /table\.data td\.cellActions:has\(\.actionMenu\[open\]\)\s*\{[^}]*z-index:\s*2/);
});
