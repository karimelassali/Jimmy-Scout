import { SwissLanguage } from '@/packages/types/src/database.ts';

/**
 * Checks whether current time in Europe/Zurich falls within Swiss business hours:
 * Monday through Friday, 08:30 to 17:00 CET.
 */
export function isSwissBusinessHours(date = new Date()): boolean {
  // Convert date to Europe/Zurich timezone string
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Zurich',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value; // Mon, Tue, Wed, Thu, Fri, Sat, Sun
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);

  // Check if Saturday or Sunday
  if (weekday === 'Sat' || weekday === 'Sun') {
    return false;
  }

  // Check 08:30 to 17:00
  const timeInMinutes = hour * 60 + minute;
  const startMinutes = 8 * 60 + 30; // 08:30 -> 510
  const endMinutes = 17 * 60;       // 17:00 -> 1020

  return timeInMinutes >= startMinutes && timeInMinutes <= endMinutes;
}

/**
 * Generates a randomized delay between 8 and 18 minutes (in milliseconds)
 * to maintain humanized email dispatch jitter and avoid spam filters.
 */
export function getRandomJitterMs(): number {
  const minMinutes = 8;
  const maxMinutes = 18;
  const randomMinutes = minMinutes + Math.random() * (maxMinutes - minMinutes);
  return Math.floor(randomMinutes * 60 * 1000);
}

/**
 * Maps Swiss Canton abbreviation to official Swiss correspondence language:
 * TI -> Italian
 * GE, VD, NE, JU, VS, FR -> French (Romandie)
 * All other 19 cantons -> German (Deutschschweiz)
 */
export function getLanguageForCanton(canton: string): SwissLanguage {
  const c = canton.toUpperCase().trim();
  if (c === 'TI') {
    return 'it';
  }
  const frenchCantons = ['GE', 'VD', 'NE', 'JU', 'VS', 'FR'];
  if (frenchCantons.includes(c)) {
    return 'fr';
  }
  return 'de';
}

/**
 * Anti-harassment 30-day rule check
 */
export function isEligibleForOutbound(
  lastContactedAt?: string | null,
  unsubscribed = false
): boolean {
  if (unsubscribed) return false;
  if (!lastContactedAt) return true;

  const lastDate = new Date(lastContactedAt).getTime();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  return Date.now() - lastDate > thirtyDaysMs;
}
