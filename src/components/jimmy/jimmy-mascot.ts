// Jimmy mascot states — approved by Karim (12 Nov 2026): three still images
// of the same robot (orange helmet, plain backgrounds). The animated
// jimmymascut.webm is kept in public/ but no longer shown here.
//
// State is derived only from state the app already has — nothing new is
// invented, and the master switch / scheduler logic is untouched:
//   - sleeping : the app is paused (master switch off)
//   - working  : master on and discovery or outreach is actively running
//   - waiting  : everything else (idle between runs, outside business hours,
//                quota reached, unknown) — also the default when the state
//                cannot be determined cleanly.

export type JimmyMascotState = 'working' | 'sleeping' | 'waiting';

// NOTE: these are the exact filenames uploaded to
// public/assets/illustrations/ on GitHub (12 Nov 2026). If the files are
// ever renamed, update the paths here to match.
export const JIMMY_MASCOT_SRC: Record<JimmyMascotState, string> = {
  working: '/assets/illustrations/working.png',
  sleeping: '/assets/illustrations/sleeping.png',
  waiting:
    '/assets/illustrations/media-generation-jimmy-waiting-0-85cf4a44-17b1-498b-ae8a-573959f66a2d.png',
};

export const JIMMY_MASCOT_ALT: Record<JimmyMascotState, string> = {
  working: 'Jimy travaille — il cherche des occasions',
  sleeping: 'Jimy dort — l’application est en pause',
  waiting: 'Jimy attend — il guette la prochaine occasion',
};

export function getJimmyMascotState(input: {
  isActive: boolean;
  schedulerState?: string | null;
  discoveryState?: string | null;
}): JimmyMascotState {
  if (!input.isActive) return 'sleeping';
  if (input.schedulerState === 'running' || input.discoveryState === 'running') {
    return 'working';
  }
  return 'waiting';
}
