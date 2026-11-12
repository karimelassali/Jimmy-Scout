import test from 'node:test';
import assert from 'node:assert/strict';

import {
  supabaseDataService,
  isNotFoundStorageError,
} from '../apps/worker/src/services/supabase.service.ts';

// Regression tests for the 12 Nov 2026 data loss: during a Supabase outage
// the app booted, could not download production-state.json, fell back to an
// empty in-memory state — and a later save overwrote the file with that
// empty state, wiping 17 companies. The guard: a failed load must never
// lead to a write of the saved state, and the next access must retry the
// load instead of serving the empty fallback forever.

const service = supabaseDataService as any;

function installFakeClient(downloadImpl: () => Promise<any>, uploads: string[]) {
  service.client = {
    storage: {
      listBuckets: async () => ({ data: [{ name: 'jimiscout-data' }], error: null }),
      from: () => ({
        download: downloadImpl,
        upload: async (_file: string, payload: string) => {
          uploads.push(payload);
          return { error: null };
        },
      }),
    },
  };
  // Keep the SQL layer out of these tests: the state file is what matters.
  service.sqlTablesAvailable = false;
  service.cachedState = null;
  service.stateLoadPromise = null;
}

function reset() {
  supabaseDataService.resetForTests();
  service.client = null;
  service.cachedState = null;
  service.stateLoadPromise = null;
}

test('isNotFoundStorageError only treats a genuinely missing object as "no file yet"', () => {
  assert.equal(isNotFoundStorageError({ statusCode: 404, message: 'Object not found' }), true);
  assert.equal(isNotFoundStorageError({ message: 'Object not found' }), true);
  assert.equal(
    isNotFoundStorageError({ message: 'The connection to the database timed out' }),
    false
  );
  assert.equal(isNotFoundStorageError({ message: 'Too many connections issued' }), false);
  assert.equal(isNotFoundStorageError(new Error('boom')), false);
  assert.equal(isNotFoundStorageError(null), false);
  assert.equal(isNotFoundStorageError(undefined), false);
});

test('a failed state download never overwrites the saved file, and writes are refused', async () => {
  reset();
  const uploads: string[] = [];
  installFakeClient(
    async () => ({
      data: null,
      error: { message: 'The connection to the database timed out', statusCode: 500 },
    }),
    uploads
  );

  const companies = await supabaseDataService.getCompanies();
  assert.deepEqual(companies, []);
  assert.equal(uploads.length, 0, 'no write must happen after a failed load');

  await assert.rejects(
    supabaseDataService.addCompany({
      name: 'Should Not Persist AG',
      email: 'nope@should-not-persist.ch',
      canton: 'ZH',
      language: 'de',
    }),
    /Refusing to overwrite saved state/
  );
  assert.equal(uploads.length, 0, 'a refused write must not reach storage');
});

test('once Supabase recovers, the next access reloads the real saved state', async () => {
  reset();
  const uploads: string[] = [];
  let downloadImpl: () => Promise<any> = async () => ({
    data: null,
    error: { message: 'The connection to the database timed out', statusCode: 500 },
  });
  installFakeClient(() => downloadImpl(), uploads);

  assert.deepEqual(await supabaseDataService.getCompanies(), []);
  assert.equal(uploads.length, 0);

  const savedState = {
    companies: [
      {
        id: '00000000-0000-4000-8000-000000000101',
        name: 'Implenia Schweiz AG',
        email: 'info@implenia.com',
        canton: 'ZH',
        language: 'de',
        unsubscribed: false,
        created_at: new Date().toISOString(),
      },
    ],
  };
  downloadImpl = async () => ({
    data: { text: async () => JSON.stringify(savedState) },
    error: null,
  });

  const companies = await supabaseDataService.getCompanies();
  assert.equal(companies.length, 1);
  assert.equal(companies[0].name, 'Implenia Schweiz AG');
  assert.equal(uploads.length, 0, 'a reload must not write anything either');

  // Writes work again now that a load has succeeded.
  await supabaseDataService.addCompany({
    name: 'Second Company AG',
    email: 'info@second-company.ch',
    canton: 'BE',
    language: 'de',
  });
  assert.equal(uploads.length, 1);
  const persisted = JSON.parse(uploads[0]);
  assert.equal(persisted.companies.length, 2);
});

test('a genuinely missing state file (404) still creates the initial file once', async () => {
  reset();
  const uploads: string[] = [];
  installFakeClient(
    async () => ({ data: null, error: { statusCode: 404, message: 'Object not found' } }),
    uploads
  );

  assert.deepEqual(await supabaseDataService.getCompanies(), []);
  assert.equal(uploads.length, 1, 'first boot may create the initial file');
  assert.deepEqual(JSON.parse(uploads[0]).companies, []);
});
