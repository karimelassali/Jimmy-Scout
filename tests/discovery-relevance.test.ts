import test from 'node:test';
import assert from 'node:assert/strict';

import { relevanceScore } from '../apps/worker/src/services/company-discovery.service.ts';

// Relevance scoring, tightened 12 Nov 2026: Verein PRS PET-Recycling scored
// 0.66 (base 0.52 + 0.09 for bare "recycling" + 0.05 for a website) and
// reached the ready list; a curtain shop got in the same way. A single
// generic word must never be enough, and off-field activities are vetoed.

function place(name: string, website: string | null, types: string[] = []) {
  return { id: 'test:1', name, website, types };
}

test('PET recycling association is vetoed, whatever the score', () => {
  const result = relevanceScore(
    place('Verein PRS PET-Recycling Schweiz', 'https://www.prs.ch', ['Recycling']),
    'PET-Recycling Schweiz. Sammlung und Recycling von PET-Getränkeflaschen. Recycling von Kunststoffen.'
  );
  assert.equal(result.score, 0);
  assert.match(result.reason, /Off-field/);
});

test('curtain / decor shop is vetoed', () => {
  const result = relevanceScore(
    place('DECOROF BERN AG', 'https://www.decorof-bern.ch', ['Home goods']),
    "Rideaux, voilages et décoration d'intérieur. Vente de rideaux sur mesure à Berne."
  );
  assert.equal(result.score, 0);
  assert.match(result.reason, /Off-field/);
});

test('a single generic "recycling" match stays below the 0.65 threshold', () => {
  const result = relevanceScore(
    place('RecyclePro GmbH', 'https://www.recyclepro.example', ['Recycling']),
    'We offer recycling services for businesses. Recycling, collection and sorting.'
  );
  assert.ok(result.score < 0.65, `score was ${result.score}`);
});

test('a single generic "construction" word stays below the threshold', () => {
  const result = relevanceScore(
    place('Some Holdings Ltd', 'https://www.someholdings.example', []),
    'Construction and real estate investments.'
  );
  // 0.50 base + 0.03 generic + 0.05 website (float, so compare with tolerance).
  assert.ok(Math.abs(result.score - 0.58) < 0.001, `score was ${result.score}`);
  assert.ok(result.score < 0.65);
});

test('one strong term plus a website passes', () => {
  const result = relevanceScore(
    place('Müller Aarberg AG', 'https://www.mueller-aarberg.example'),
    'Wir sind eine Bauunternehmung in Aarberg.'
  );
  assert.equal(result.score, 0.67);
  assert.ok(result.score >= 0.65);
});

test('legit construction candidates still pass', () => {
  const cases: Array<[string, string, string]> = [
    [
      'KIBAG Kieswerk & Concassage AG',
      'Kieswerk, Baustoffe und Beton. Abbau und Aufbereitung von Kies und Sand.',
      'https://www.kibag.example',
    ],
    [
      'Entreprise de terrassement Durand SA',
      'Terrassement, démolition et génie civil en Suisse romande.',
      'https://www.durand.example',
    ],
    [
      'Baustoff Recycling AG',
      'Baustoffrecycling und Betonrecycling für die Bauwirtschaft.',
      'https://www.baustoff-recycling.example',
    ],
  ];
  for (const [name, text, website] of cases) {
    const result = relevanceScore(place(name, website), text);
    assert.ok(result.score >= 0.65, `${name} scored ${result.score}`);
  }
});

test('one strong term without a website is not enough on its own', () => {
  const result = relevanceScore(place('Müller Aarberg AG', null), 'Wir sind eine Bauunternehmung in Aarberg.');
  assert.equal(result.score, 0.62);
  assert.ok(result.score < 0.65);
});
