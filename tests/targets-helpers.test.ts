import test from 'node:test';
import assert from 'node:assert/strict';

import type { Company } from '../packages/types/src/database.ts';
import { POOL_SAMPLE } from '../src/data/pool-sample.ts';
import { isConstructionCompany } from '../src/data/construction-filter.ts';
import {
  normalizeSearch,
  getCompanyStatus,
  filterCompanies,
  filterPool,
} from '../src/components/targets/targets-helpers.ts';

// Tests for the redesigned Targets screen ("Entreprises prêtes", 12 Nov 2026):
// the list/filter/status logic that decides what a user sees, and the
// developer-only pool (raw LINDAS sample) that must stay hidden unless
// dev mode is on. Rendering itself is covered by `npm run build` + lint;
// there is no jsdom in this repo, so no DOM-level render test exists yet.

function company(overrides: Partial<Company>): Company {
  return {
    id: `id-${overrides.name ?? 'x'}`,
    name: 'Test AG',
    canton: 'ZH',
    language: 'de',
    email: 'info@test.ch',
    verified_email: true,
    unsubscribed: false,
    created_at: '2026-11-12T00:00:00Z',
    ...overrides,
  } as Company;
}

const SAMPLE: Company[] = [
  company({ name: 'Frutiger AG', city: 'Thun', canton: 'BE', email: 'info@frutiger.com' }),
  company({ name: 'Implenia Schweiz AG', city: 'Glattpark (Opfikon)', canton: 'ZH', email: 'info@implenia.com' }),
  company({ name: 'Marti Construction SA', city: 'Lausanne', canton: 'VD', language: 'fr', email: 'direction@marti-vd.ch' }),
  company({ name: 'Sans Email SA', city: 'Bern', canton: 'BE', email: '' }),
  company({
    name: 'À Vérifier GmbH',
    city: 'Zürich',
    canton: 'ZH',
    email: 'hallo@averifier.ch',
    verified_email: false,
  }),
  company({
    name: 'Refus SA',
    city: 'Genève',
    canton: 'GE',
    language: 'fr',
    email: 'stop@refus.ch',
    unsubscribed: true,
  }),
];

test('normalizeSearch is accent-insensitive', () => {
  assert.equal(normalizeSearch('Zürich'), 'zurich');
  assert.equal(normalizeSearch('À Vérifier'), 'a verifier');
  assert.equal(normalizeSearch('Genève'), 'geneve');
});

test('getCompanyStatus classifies ready / to_verify / no_email / refused', () => {
  assert.equal(getCompanyStatus(SAMPLE[0]), 'ready');
  assert.equal(getCompanyStatus(SAMPLE[4]), 'to_verify');
  assert.equal(getCompanyStatus(SAMPLE[3]), 'no_email');
  assert.equal(getCompanyStatus(SAMPLE[5]), 'refused');
});

test('filterCompanies: empty filters return everything, sorted by name', () => {
  const out = filterCompanies(SAMPLE, '', 'all', 'all', 'all');
  assert.equal(out.length, SAMPLE.length);
  assert.deepEqual(
    out.map((c) => c.name),
    [...SAMPLE.map((c) => c.name)].sort((a, b) => a.localeCompare(b, 'fr'))
  );
});

test('filterCompanies: search matches name, city, canton and email, accent-insensitive', () => {
  assert.deepEqual(
    filterCompanies(SAMPLE, 'zurich', 'all', 'all', 'all').map((c) => c.name),
    ['À Vérifier GmbH']
  );
  assert.deepEqual(
    filterCompanies(SAMPLE, 'marti', 'all', 'all', 'all').map((c) => c.name),
    ['Marti Construction SA']
  );
  assert.deepEqual(
    filterCompanies(SAMPLE, 'frutiger.com', 'all', 'all', 'all').map((c) => c.name),
    ['Frutiger AG']
  );
  assert.deepEqual(
    filterCompanies(SAMPLE, 'lausanne', 'all', 'all', 'all').map((c) => c.name),
    ['Marti Construction SA']
  );
});

test('filterCompanies: canton, language and status filters combine as AND', () => {
  assert.deepEqual(
    filterCompanies(SAMPLE, '', 'BE', 'all', 'all').map((c) => c.name),
    ['Frutiger AG', 'Sans Email SA']
  );
  assert.deepEqual(
    filterCompanies(SAMPLE, '', 'all', 'fr', 'all').map((c) => c.name),
    ['Marti Construction SA', 'Refus SA']
  );
  assert.deepEqual(
    filterCompanies(SAMPLE, '', 'all', 'all', 'ready').map((c) => c.name),
    ['Frutiger AG', 'Implenia Schweiz AG', 'Marti Construction SA']
  );
  assert.deepEqual(
    filterCompanies(SAMPLE, '', 'all', 'all', 'to_verify').map((c) => c.name),
    ['À Vérifier GmbH']
  );
  assert.deepEqual(
    filterCompanies(SAMPLE, '', 'all', 'all', 'no_email').map((c) => c.name),
    ['Sans Email SA']
  );
  // Refused companies only appear under "Toutes", never under a status chip.
  assert.equal(
    filterCompanies(SAMPLE, '', 'all', 'all', 'ready').some((c) => c.name === 'Refus SA'),
    false
  );
});

test('pool sample: 21 clean construction-only LINDAS rows', () => {
  assert.equal(POOL_SAMPLE.length, 21);
  const names = POOL_SAMPLE.map((p) => p.name);
  // The old "bau" substring sample let these off-field rows in — they are gone.
  assert.ok(!names.includes('INSEKTOL AG PEST CONTROL'));
  assert.ok(!names.includes('Bio-Agrar-Counsel GmbH'));
  assert.ok(!names.includes('Hauert HBG Dünger AG'));
  assert.ok(!names.includes('Schneiter AGRO AG'));
  assert.ok(!names.includes('Société suisse des employés de commerce'));
  assert.ok(names.includes('Gebr. Huber AG'));
  assert.ok(names.includes('Baucal AG'));
  for (const p of POOL_SAMPLE) {
    assert.match(p.uid, /^CHE\d+$/);
    assert.ok(p.city.length > 0);
    assert.ok(p.canton.length === 2);
    assert.ok(p.purpose.length > 0);
    assert.equal(isConstructionCompany(p.name, p.purpose), true, `${p.name} must be construction`);
  }
});

test('filterPool: empty search shows all 21 rows; search filters live', () => {
  assert.equal(filterPool(POOL_SAMPLE, '').length, 21);
  assert.equal(filterPool(POOL_SAMPLE, 'baucal').length, 1);
  assert.equal(filterPool(POOL_SAMPLE, 'baucal')[0].uid, 'CHE101961641');
  assert.equal(filterPool(POOL_SAMPLE, 'CHE106019754').length, 1);
  assert.equal(filterPool(POOL_SAMPLE, 'CHE106019754')[0].name, 'Clausen Beton-Trenn AG');
  assert.equal(filterPool(POOL_SAMPLE, 'affoltern').length, 2);
  assert.equal(filterPool(POOL_SAMPLE, 'zzz-no-match').length, 0);
});
