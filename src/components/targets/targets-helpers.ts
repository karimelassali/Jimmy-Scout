// Pure helpers for the Targets ("Entreprises prêtes") screen — kept free of
// React/CSS imports so they can be unit-tested with plain node:test.

import type { Company } from '@/packages/types/src/database.ts';
import type { PoolCompany } from '@/src/data/pool-sample.ts';

export type CompanyStatus = 'ready' | 'to_verify' | 'no_email' | 'refused';
export type StatusFilter = 'all' | 'ready' | 'to_verify' | 'no_email';

/** Accent-insensitive lowercase, so "Zurich" matches "Zürich". */
export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

export function getCompanyStatus(company: Company): CompanyStatus {
  if (company.unsubscribed) return 'refused';
  if (!company.email) return 'no_email';
  if (company.verified_email === false) return 'to_verify';
  return 'ready';
}

export function filterCompanies(
  companies: Company[],
  search: string,
  canton: string,
  language: string,
  status: StatusFilter
): Company[] {
  const q = normalizeSearch(search.trim());
  return companies
    .filter((c) => {
      if (canton !== 'all' && c.canton.toUpperCase() !== canton) return false;
      if (language !== 'all' && (c.language || 'de') !== language) return false;
      if (status !== 'all' && getCompanyStatus(c) !== status) return false;
      if (!q) return true;
      const haystack = normalizeSearch(
        [c.name, c.city || '', c.canton, c.email || '', c.contact_person || ''].join(' ')
      );
      return haystack.includes(q);
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

export function filterPool(pool: PoolCompany[], search: string): PoolCompany[] {
  const q = normalizeSearch(search.trim());
  if (!q) return pool;
  return pool.filter((p) => {
    const haystack = normalizeSearch(
      [p.name, p.city, p.canton, p.uid, p.purpose].join(' ')
    );
    return haystack.includes(q);
  });
}
