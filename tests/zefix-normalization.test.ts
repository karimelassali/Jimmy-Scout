import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeZefixEntries,
  normalizeZefixEntry,
  searchZefixCompanies,
} from '../apps/worker/src/services/zefix.service.ts';

// Pure normalization only — no network, no credentials.

const IMPLENIA_RAW = {
  name: 'Implenia AG',
  ehraid: 807949,
  uid: 'CHE112626997',
  chid: 'CH17030288424',
  legalSeatId: 66,
  legalSeat: 'Opfikon',
  registryOfCommerceId: 20,
  legalForm: {
    id: 3,
    uid: '0106',
    name: { de: 'Aktiengesellschaft', fr: 'Société anonyme', it: 'Società anonima', en: 'Corporation' },
    shortName: { de: 'AG', fr: 'SA', it: 'SA', en: 'Ltd' },
  },
  status: 'ACTIVE',
  sogcDate: '2025-07-21',
  deletionDate: null,
};

test('normalizes a real Zefix record to the small API shape', () => {
  assert.deepEqual(normalizeZefixEntry(IMPLENIA_RAW), {
    name: 'Implenia AG',
    legalForm: 'SA',
    uid: 'CHE112626997',
    status: 'ACTIVE',
    city: 'Opfikon',
  });
});

test('normalizes a top-level array payload and drops nameless rows', () => {
  const entries = normalizeZefixEntries([
    IMPLENIA_RAW,
    { uid: 'CHE000000000', status: 'ACTIVE' },
    { name: '  ', uid: 'CHE111111111' },
    { name: 'Implenia Vorsorge', uid: 'CHE109325934', legalSeat: 'Basel', status: 'ACTIVE' },
  ]);
  assert.strictEqual(entries.length, 2);
  assert.strictEqual(entries[0].name, 'Implenia AG');
  assert.strictEqual(entries[1].city, 'Basel');
  assert.strictEqual(entries[1].legalForm, undefined);
});

test('accepts { companies: [...] } wrappers and unknown shapes defensively', () => {
  assert.strictEqual(normalizeZefixEntries({ companies: [IMPLENIA_RAW] }).length, 1);
  assert.deepEqual(normalizeZefixEntries({ entries: [IMPLENIA_RAW] }).length, 1);
  assert.deepEqual(normalizeZefixEntries(null), []);
  assert.deepEqual(normalizeZefixEntries(undefined), []);
  assert.deepEqual(normalizeZefixEntries('not json'), []);
  assert.deepEqual(normalizeZefixEntries({ companies: 'nope' }), []);
  assert.strictEqual(normalizeZefixEntry(null), null);
  assert.strictEqual(normalizeZefixEntry('Implenia'), null);
});

test('search caps results locally because the live API ignores maxEntries', async () => {
  // The live API returns every match regardless of maxEntries, so the
  // service must slice. Stub fetch: no network, no credentials.
  const originalFetch = globalThis.fetch;
  const many = Array.from({ length: 12 }, (_, i) => ({
    name: `Société ${i + 1}`,
    uid: `CHE00000000${i}`,
    legalSeat: 'Zurich',
    status: 'ACTIVE',
  }));
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => many,
  })) as unknown as typeof fetch;
  try {
    const entries = await searchZefixCompanies('Bau', 2, 'user', 'pass');
    assert.strictEqual(entries.length, 2);
    assert.strictEqual(entries[0].name, 'Société 1');
    assert.strictEqual(entries[1].name, 'Société 2');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('prefers the French legal-form text, falling back to other languages', () => {
  const entry = normalizeZefixEntry({
    name: 'Test GmbH',
    legalForm: { name: { de: 'Gesellschaft mit beschränkter Haftung' } },
  });
  assert.strictEqual(entry?.legalForm, 'Gesellschaft mit beschränkter Haftung');
  assert.strictEqual(
    normalizeZefixEntry({ name: 'Plain SA', legalForm: 'Société anonyme' })?.legalForm,
    'Société anonyme',
  );
});
