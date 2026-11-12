import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ALL_SWISS_CANTONS } from '../packages/types/src/swiss.ts';
import { CANTON_FLAG_SRC, cantonFlagSrc } from '../src/components/common/canton-flags.ts';

// Tests for the canton flags (12 Nov 2026, Karim's request: an icon per
// canton so cantons are recognisable at a glance):
// the mapping must cover all 26 cantons, point at a real SVG file in the
// repo for each one, and the files must actually be SVGs. Rendering itself
// is covered by `npm run build` + lint; there is no jsdom in this repo, so
// no DOM-level render test exists yet.

const CANTONS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'public',
  'assets',
  'cantons'
);

test('all 26 cantons have a flag mapping', () => {
  assert.equal(ALL_SWISS_CANTONS.length, 26);
  for (const canton of ALL_SWISS_CANTONS) {
    assert.equal(
      CANTON_FLAG_SRC[canton.code],
      `/assets/cantons/${canton.code}.svg`,
      `${canton.code} should map to its flag file`
    );
  }
  assert.equal(Object.keys(CANTON_FLAG_SRC).length, 26);
});

test('every mapped flag file exists in the repo and is an SVG', () => {
  for (const canton of ALL_SWISS_CANTONS) {
    const file = path.join(CANTONS_DIR, `${canton.code}.svg`);
    assert.ok(existsSync(file), `${canton.code}.svg should exist in public/assets/cantons/`);
    const content = readFileSync(file, 'utf-8');
    assert.ok(
      content.includes('<svg'),
      `${canton.code}.svg should be an SVG document`
    );
    assert.ok(content.length > 100, `${canton.code}.svg should not be empty`);
  }
});

test('cantonFlagSrc normalises codes and returns null for unknown codes', () => {
  assert.equal(cantonFlagSrc('be'), '/assets/cantons/BE.svg');
  assert.equal(cantonFlagSrc(' ZH '), '/assets/cantons/ZH.svg');
  assert.equal(cantonFlagSrc('XX'), null);
  assert.equal(cantonFlagSrc(''), null);
  assert.equal(cantonFlagSrc(null), null);
});
