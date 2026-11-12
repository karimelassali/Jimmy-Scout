// Standalone Zefix company lookup (Swiss commercial register).
// Used by POST /api/zefix/search. Read-only: it never touches discovery,
// companies, leads or outreach. Credentials are passed in by the caller;
// this module never reads them from disk and never logs them.

export interface ZefixEntry {
  name: string;
  legalForm?: string;
  /** Abbreviated legal form (e.g. "SA", "Fond"), when the register gives one. */
  legalFormShort?: string;
  uid?: string;
  status?: string;
  city?: string;
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function pickLocalizedText(value: unknown): string | undefined {
  if (typeof value === 'string') return asNonEmptyString(value);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return (
      asNonEmptyString(record.fr) ??
      asNonEmptyString(record.de) ??
      asNonEmptyString(record.it) ??
      asNonEmptyString(record.en)
    );
  }
  return undefined;
}

/** Normalize one raw Zefix company record into the small shape the API returns. */
export function normalizeZefixEntry(raw: unknown): ZefixEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const name = asNonEmptyString(record.name);
  if (!name) return null;
  const legalForm = record.legalForm;
  // Prefer the full legal-form name ("Fondation", "Société anonyme") over the
  // short name ("Fond", "SA"): the short form is ambiguous on screen
  // ("Implenia Vorsorge" showed as just "Fond"). The short form is still
  // returned as legalFormShort for callers that want the abbreviation.
  const legalFormName =
    legalForm && typeof legalForm === 'object'
      ? pickLocalizedText((legalForm as Record<string, unknown>).name)
      : pickLocalizedText(legalForm);
  const legalFormShort =
    legalForm && typeof legalForm === 'object'
      ? pickLocalizedText((legalForm as Record<string, unknown>).shortName)
      : undefined;
  return {
    name,
    legalForm: legalFormName ?? legalFormShort,
    legalFormShort,
    uid: asNonEmptyString(record.uid),
    status: asNonEmptyString(record.status),
    city: asNonEmptyString(record.legalSeat) ?? asNonEmptyString(record.city),
  };
}

/**
 * Normalize a whole Zefix search payload. The live API returns a top-level
 * array, but { companies: [...] } / { entries: [...] } are accepted too,
 * defensively. Unknown shapes normalize to an empty list, never a crash.
 */
export function normalizeZefixEntries(payload: unknown): ZefixEntry[] {
  const list = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>).companies ??
        (payload as Record<string, unknown>).entries ??
        []
      : [];
  if (!Array.isArray(list)) return [];
  const entries: ZefixEntry[] = [];
  for (const raw of list) {
    const entry = normalizeZefixEntry(raw);
    if (entry) entries.push(entry);
  }
  return entries;
}

export class ZefixSearchError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`Zefix search failed (HTTP ${status})`);
    this.name = 'ZefixSearchError';
    this.status = status;
  }
}

/**
 * Search the Swiss commercial register by company name (active entries only).
 * NOTE: the live API ignores the maxEntries request field (verified 12 Nov
 * 2026: "Bau" returned 2,642 entries for maxEntries 1, 2, 10 and 100 alike),
 * so the cap is enforced here by slicing the normalized entries.
 */
export async function searchZefixCompanies(
  name: string,
  maxEntries: number,
  username: string,
  password: string,
): Promise<ZefixEntry[]> {
  const auth = Buffer.from(`${username}:${password}`).toString('base64');
  const response = await fetch(
    'https://www.zefix.admin.ch/ZefixPublicREST/api/v1/company/search',
    {
      method: 'POST',
      signal: AbortSignal.timeout(12_000),
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ name, activeOnly: true, maxEntries }),
    },
  );
  if (!response.ok) throw new ZefixSearchError(response.status);
  const payload: unknown = await response.json();
  return normalizeZefixEntries(payload).slice(0, Math.max(1, maxEntries));
}
