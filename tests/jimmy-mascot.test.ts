import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getJimmyMascotState,
  JIMMY_MASCOT_SRC,
  type JimmyMascotState,
} from '../src/components/jimmy/jimmy-mascot.ts';

// Tests for the Jimmy mascot states (12 Nov 2026, approved by Karim):
// sleeping while the app is paused, working while discovery/outreach runs,
// waiting while idle — and waiting whenever the state cannot be determined.

test('mascot image paths point at the three approved still images', () => {
  const states: JimmyMascotState[] = ['working', 'sleeping', 'waiting'];
  for (const state of states) {
    assert.match(JIMMY_MASCOT_SRC[state], /^\/assets\/illustrations\/.+\.png$/);
  }
  assert.equal(JIMMY_MASCOT_SRC.working, '/assets/illustrations/working.png');
  assert.equal(JIMMY_MASCOT_SRC.sleeping, '/assets/illustrations/sleeping.png');
  assert.equal(
    JIMMY_MASCOT_SRC.waiting,
    '/assets/illustrations/media-generation-jimmy-waiting-0-85cf4a44-17b1-498b-ae8a-573959f66a2d.png'
  );
});

test('sleeping while the app is paused (master switch off)', () => {
  assert.equal(getJimmyMascotState({ isActive: false }), 'sleeping');
  // Even if a scheduler reported running, a paused app sleeps.
  assert.equal(
    getJimmyMascotState({ isActive: false, schedulerState: 'running', discoveryState: 'running' }),
    'sleeping'
  );
});

test('working while discovery or outreach is actively running', () => {
  assert.equal(
    getJimmyMascotState({ isActive: true, schedulerState: 'running' }),
    'working'
  );
  assert.equal(
    getJimmyMascotState({ isActive: true, discoveryState: 'running' }),
    'working'
  );
  assert.equal(
    getJimmyMascotState({ isActive: true, schedulerState: 'enabled', discoveryState: 'running' }),
    'working'
  );
});

test('waiting while idle — and whenever the state cannot be determined', () => {
  // Outside business hours, scheduler enabled but between runs.
  assert.equal(
    getJimmyMascotState({ isActive: true, schedulerState: 'waiting_for_hours' }),
    'waiting'
  );
  assert.equal(
    getJimmyMascotState({ isActive: true, schedulerState: 'enabled' }),
    'waiting'
  );
  assert.equal(
    getJimmyMascotState({ isActive: true, discoveryState: 'waiting' }),
    'waiting'
  );
  // Quota reached / blocked / failed are not "running" — default to waiting.
  assert.equal(
    getJimmyMascotState({ isActive: true, schedulerState: 'quota_reached' }),
    'waiting'
  );
  assert.equal(
    getJimmyMascotState({ isActive: true, schedulerState: 'blocked' }),
    'waiting'
  );
  // No status at all (still loading) — default to waiting, never crash.
  assert.equal(getJimmyMascotState({ isActive: true }), 'waiting');
  assert.equal(
    getJimmyMascotState({ isActive: true, schedulerState: null, discoveryState: null }),
    'waiting'
  );
});
