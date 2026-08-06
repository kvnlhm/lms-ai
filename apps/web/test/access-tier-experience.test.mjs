import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const manager = await readFile(new URL('../app/master/access-tiers/tier-manager.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');

test('tombol buat paket memiliki jarak yang cukup dari deskripsi', () => {
  assert.match(manager, /className="btn tierCreateButton"/);
  assert.match(css, /\.tierCreateButton\s*\{[^}]*margin-top:\s*18px/);
});
