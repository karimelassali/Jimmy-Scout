import test from 'node:test';
import assert from 'node:assert/strict';

// Force isolated in-memory storage and external service stubs BEFORE importing app modules
process.env.JIMISCOUT_STUB_EXTERNAL = 'true';
process.env.JIMISCOUT_USE_MEMORY_ONLY = 'true';
process.env.JIMISCOUT_DISABLE_DAEMON = 'true';
process.env.JIMISCOUT_ADMIN_TOKEN = 'test-admin-token';
process.env.WEBHOOK_SECRET = 'test-webhook-secret-2026';

import { app } from '../server.ts';

// Follow-up fix 12 Nov 2026: the "Paiement immédiat" switch lagged on the
// way back ON because PATCH /api/settings silently dropped the `hooks`
// object — the handler only accepted an array of strings, while the client
// sends the PersonaHooks object { cash_settlement, transport_covered, as_is }.
// The PATCH response then carried the stale hooks back and the optimistic UI
// flipped to the old value. This test drives the exact round-trip the UI
// does: toggle one hook, check the PATCH response AND a fresh GET both
// carry it.

test('PATCH /api/settings persists a PersonaHooks object round-trip', async () => {
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object', 'test server must listen');
    const base = `http://127.0.0.1:${address.port}`;
    const authHeaders = { 'x-admin-token': 'test-admin-token' };

    const before = await (
      await fetch(`${base}/api/settings`, { headers: authHeaders })
    ).json();
    assert.ok(
      before.hooks && typeof before.hooks === 'object',
      'settings must carry a hooks object'
    );
    const toggled = {
      cash_settlement: !before.hooks.cash_settlement,
      transport_covered: before.hooks.transport_covered,
      as_is: before.hooks.as_is,
    };

    const patched = await (
      await fetch(`${base}/api/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ hooks: toggled }),
      })
    ).json();
    assert.deepEqual(
      patched.hooks,
      toggled,
      'PATCH response must carry the toggled hooks object'
    );

    const after = await (
      await fetch(`${base}/api/settings`, { headers: authHeaders })
    ).json();
    assert.deepEqual(
      after.hooks,
      toggled,
      'a fresh GET must see the persisted hooks object'
    );

    // Restore the original value so the test leaves no trace.
    await fetch(`${base}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({ hooks: before.hooks }),
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
