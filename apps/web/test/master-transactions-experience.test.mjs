import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('../app/master/transactions/page.tsx', import.meta.url), 'utf8');
const list = await readFile(new URL('../app/master/transactions/transaction-list.tsx', import.meta.url), 'utf8');
const css = await readFile(new URL('../app/styles.css', import.meta.url), 'utf8');

test('halaman transaksi memakai wadah dan komponen visual workspace Master', () => {
  assert.match(page, /className="masterContent transactionPage"/);
  assert.doesNotMatch(page, /<main className="wrap">/);
  assert.match(list, /className="trxSummary" aria-label="Ringkasan transaksi"/);
  assert.match(list, /className="card userTableCard transactionTableCard"/);
  assert.match(list, /className="transactionListHead"/);
});

test('filter transaksi memiliki label aksesibel dan pencarian berikon', () => {
  assert.match(list, /aria-label="Cari dan saring transaksi"/);
  assert.match(list, /<Search size=\{17\}/);
  assert.match(list, /<span className="srOnly">Saring status transaksi<\/span>/);
});

test('transaksi menjadi kartu yang dapat dibaca pada layar mobile', () => {
  assert.match(css, /@media\(max-width:680px\)[\s\S]*\.transactionFilterBar\{grid-template-columns:1fr 1fr\}/);
  assert.match(css, /\.transactionTableCard table\.data tr\{[^}]*box-shadow:var\(--shadow\)/);
  assert.match(css, /@media\(max-width:390px\)[\s\S]*\.trxSummary\{grid-template-columns:1fr\}/);
});
