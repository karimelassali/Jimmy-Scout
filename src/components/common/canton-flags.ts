// Official flags of the 26 Swiss cantons, one per canton code.
//
// Source: Wikimedia Commons, "Flag of Canton of <name>.svg" (public domain,
// official canton flags). Files live in public/assets/cantons/ as
// <CODE>.svg and are served at /assets/cantons/<CODE>.svg.
//
// This is the single place that maps canton codes to flags. If a flag file
// is ever renamed, update the paths here.
import { ALL_SWISS_CANTONS } from '@/packages/types/src/swiss.ts';

/** Canton code (upper-case) -> flag image URL, for all 26 cantons. */
export const CANTON_FLAG_SRC: Record<string, string> = Object.fromEntries(
  ALL_SWISS_CANTONS.map((canton) => [canton.code, `/assets/cantons/${canton.code}.svg`])
);

/** Flag image URL for a canton code, or null when the code is not a canton. */
export function cantonFlagSrc(code: string | null | undefined): string | null {
  const upper = (code || '').trim().toUpperCase();
  return CANTON_FLAG_SRC[upper] ?? null;
}
