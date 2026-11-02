import { Company, SuppressionEntry, SwissLanguage } from '@/packages/types/src/database.ts';
import { ALL_SWISS_CANTONS } from '@/packages/types/src/swiss.ts';

/**
 * Extracts Europe/Zurich calendar parts safely, handling 24:00 formatting quirks.
 */
export function getZurichParts(date = new Date()): {
  year: number;
  month: number;
  day: number;
  weekday: string;
  hour: number;
  minute: number;
  second: number;
} {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';

  let hour = parseInt(get('hour') || '0', 10);
  if (hour === 24) hour = 0;

  return {
    year: parseInt(get('year') || '2026', 10),
    month: parseInt(get('month') || '1', 10),
    day: parseInt(get('day') || '1', 10),
    weekday: get('weekday'),
    hour,
    minute: parseInt(get('minute') || '0', 10),
    second: parseInt(get('second') || '0', 10),
  };
}

/**
 * Checks whether the given Date falls within Swiss business hours:
 * Monday through Friday, 08:30 to 17:00 Europe/Zurich (CET/CEST).
 */
export function isSwissBusinessHours(date = new Date()): boolean {
  const { weekday, hour, minute } = getZurichParts(date);

  if (weekday === 'Sat' || weekday === 'Sun') {
    return false;
  }

  const timeInMinutes = hour * 60 + minute;
  const startMinutes = 8 * 60 + 30; // 08:30 -> 510
  const endMinutes = 17 * 60;       // 17:00 -> 1020

  return timeInMinutes >= startMinutes && timeInMinutes < endMinutes;
}

/**
 * Returns the YYYY-MM-DD date string in Europe/Zurich timezone, plus start/end UTC timestamps
 * for accurate daily quota enforcement across CET/CEST daylight saving transitions.
 */
export function getSwissDayKey(date = new Date()): string {
  const { year, month, day } = getZurichParts(date);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function isSameSwissDay(isoTimestamp: string, referenceDate = new Date()): boolean {
  try {
    const d = new Date(isoTimestamp);
    if (isNaN(d.getTime())) return false;
    return getSwissDayKey(d) === getSwissDayKey(referenceDate);
  } catch {
    return false;
  }
}

/**
 * Computes the next valid Europe/Zurich business timestamp (08:30 Mon-Fri)
 * when a job is scheduled or deferred outside business hours.
 */
export function getNextSwissBusinessWindowStart(fromDate = new Date()): Date {
  if (isSwissBusinessHours(fromDate)) {
    return new Date(fromDate.getTime());
  }

  // Advance in 15-minute increments up to 4 days until we hit 08:30 in Europe/Zurich on Mon-Fri
  let probe = new Date(fromDate.getTime());
  // Round to next minute
  probe.setUTCSeconds(0, 0);

  for (let i = 0; i < 4 * 24 * 60; i++) {
    probe = new Date(probe.getTime() + 60 * 1000);
    if (isSwissBusinessHours(probe)) {
      return probe;
    }
  }

  return new Date(fromDate.getTime() + 12 * 60 * 60 * 1000);
}

/**
 * Generates a randomized delay between 8 and 18 minutes (in milliseconds)
 * to maintain humanized email dispatch spacing.
 */
export function getRandomJitterMs(): number {
  const minMinutes = 8;
  const maxMinutes = 18;
  const randomMinutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
  return Math.floor(randomMinutes * 60 * 1000);
}

/**
 * Maps all 26 Swiss Canton abbreviations to their official default language.
 */
export function getLanguageForCanton(canton: string): SwissLanguage {
  const c = (canton || '').toUpperCase().trim();
  const found = ALL_SWISS_CANTONS.find((item) => item.code === c);
  if (found) {
    return found.defaultLanguage;
  }
  if (c === 'TI') return 'it';
  if (['GE', 'VD', 'NE', 'JU', 'VS', 'FR'].includes(c)) return 'fr';
  return 'de';
}

/**
 * Resolves the outbound language for a company:
 * Uses the company's verified language first (supporting bilingual cantons like BE, FR, VS, GR),
 * falling back to the canton's default language only if missing.
 */
export function resolveCompanyLanguage(company: {
  language?: SwissLanguage | string | null;
  canton: string;
  language_override?: boolean;
}): SwissLanguage {
  if (company.language === 'de' || company.language === 'fr' || company.language === 'it') {
    return company.language;
  }
  return getLanguageForCanton(company.canton);
}

/**
 * Checks whether an email or domain is suppressed in the durable suppression registry.
 */
export function isAddressSuppressed(
  email: string,
  suppressions: SuppressionEntry[] = []
): { suppressed: boolean; reason?: string } {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { suppressed: true, reason: 'invalid_email' };
  }
  const domain = cleanEmail.split('@')[1];

  for (const s of suppressions) {
    if (s.email && s.email.trim().toLowerCase() === cleanEmail) {
      return { suppressed: true, reason: `email_suppressed:${s.reason}` };
    }
    if (s.domain && s.domain.trim().toLowerCase() === domain) {
      return { suppressed: true, reason: `domain_suppressed:${s.reason}` };
    }
  }
  return { suppressed: false };
}

/**
 * Anti-harassment 30-day rule & suppression check.
 */
export function isEligibleForOutbound(
  lastContactedAt?: string | null,
  unsubscribed = false,
  options?: {
    email?: string;
    verifiedEmail?: boolean;
    suppressions?: SuppressionEntry[];
    claimedAt?: string | null;
    nowMs?: number;
  }
): boolean {
  if (unsubscribed) return false;
  if (options?.verifiedEmail === false) return false;

  if (options?.email) {
    const clean = options.email.trim();
    if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
      return false;
    }
    if (options.suppressions && options.suppressions.length > 0) {
      const sup = isAddressSuppressed(clean, options.suppressions);
      if (sup.suppressed) return false;
    }
  }

  const now = options?.nowMs ?? Date.now();

  // If currently claimed by an active worker within the last 5 minutes, skip
  if (options?.claimedAt) {
    const claimedTime = new Date(options.claimedAt).getTime();
    if (!isNaN(claimedTime) && now - claimedTime < 5 * 60 * 1000) {
      return false;
    }
  }

  if (!lastContactedAt) return true;

  const lastDate = new Date(lastContactedAt).getTime();
  if (isNaN(lastDate)) return true;

  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return now - lastDate > thirtyDaysMs;
}
