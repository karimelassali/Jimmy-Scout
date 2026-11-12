// Pure helpers for the Targets ("Entreprises prêtes") screen — kept free of
// React/CSS imports so they can be unit-tested with plain node:test.

import type { Company, SuppressionEntry } from '@/packages/types/src/database.ts';
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

/**
 * Villes vérifiées au registre des entreprises (Zefix), recherche du
 * 12 nov. 2026. Ne contient que des villes confirmées par le registre pour
 * le siège de la société — jamais de villes devinées ni copiées d'un mock.
 * - Käppeli Bau AG : siège (SA, CHE105762075) à Sargans ; les succursales
 *   sont à Walenstadt, Bad Ragaz, Coire et Mels.
 * KIBAG Kieswerk & Concassage AG et Züblin Bau AG : aucune entrée sous ce
 * nom exact au registre le 12 nov. 2026 — pas de ville vérifiée, donc pas
 * d'entrée ici ; l'affichage retombe sur le canton (voir getDisplayCity).
 */
export const VERIFIED_CITY_BY_NAME: Record<string, string> = {
  'Käppeli Bau AG': 'Sargans',
};

/**
 * Ville affichée pour une société : la ville enregistrée, sinon la ville
 * vérifiée au registre, sinon le canton — jamais « Ville inconnue ».
 */
export function getDisplayCity(company: Company): string {
  if (company.city) return company.city;
  const verified = VERIFIED_CITY_BY_NAME[company.name];
  if (verified) return verified;
  return `Canton ${company.canton}`;
}

/**
 * Trouve l'entrée de refus qui concerne cette société (même courriel, ou
 * même domaine). La liste des refus est globale ; sans ce filtre, le
 * registre des refus mélangerait les rebonds de toutes les sociétés.
 */
export function findSuppressionForCompany(
  suppressions: SuppressionEntry[],
  company: Company
): SuppressionEntry | undefined {
  const email = (company.email || '').trim().toLowerCase();
  if (email) {
    const byEmail = suppressions.find(
      (s) => (s.email || '').trim().toLowerCase() === email && s.unsubscribed !== false
    );
    if (byEmail) return byEmail;
    const domain = email.split('@')[1];
    if (domain) {
      const byDomain = suppressions.find(
        (s) => (s.domain || '').trim().toLowerCase() === domain && s.unsubscribed !== false
      );
      if (byDomain) return byDomain;
    }
  }
  return undefined;
}

/** Libellé français d'un motif de refus, pour l'affichage sur la carte. */
export function suppressionReasonLabel(reason: string): string {
  switch (reason) {
    case 'hard_bounce':
      return 'courriel en rebond';
    case 'complaint':
      return 'plainte pour spam';
    case 'unsubscribe_reply':
      return 'désinscription par courriel';
    case 'manual_opt_out':
    case 'manual_suppression':
      return 'refus manuel';
    default:
      return reason;
  }
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
        [c.name, getDisplayCity(c), c.canton, c.email || '', c.contact_person || ''].join(' ')
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
