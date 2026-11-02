import { SwissLanguage } from './database.ts';

export interface SwissCantonMeta {
  code: string;
  name: string;
  nameDe: string;
  nameFr: string;
  nameIt: string;
  region: 'Romandie (FR)' | 'Deutschschweiz (DE)' | 'Ticino (IT)';
  defaultLanguage: SwissLanguage;
  language: SwissLanguage;
  bilingual?: SwissLanguage[];
  plz: string;
  primarySector: string;
}

export const ALL_SWISS_CANTONS: SwissCantonMeta[] = [
  { code: 'ZH', name: 'Zürich', nameDe: 'Zürich', nameFr: 'Zurich', nameIt: 'Zurigo', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '8000', primarySector: 'Tiefbau & Heavy Earthworks' },
  { code: 'BE', name: 'Bern', nameDe: 'Bern', nameFr: 'Berne', nameIt: 'Berna', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', bilingual: ['de', 'fr'], plz: '3000', primarySector: 'Kieswerk & Mineral Quarries' },
  { code: 'LU', name: 'Luzern', nameDe: 'Luzern', nameFr: 'Lucerne', nameIt: 'Lucerna', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '6000', primarySector: 'Road Construction & Civil Works' },
  { code: 'UR', name: 'Uri', nameDe: 'Uri', nameFr: 'Uri', nameIt: 'Uri', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '6460', primarySector: 'Alpine Tunneling & Rock Works' },
  { code: 'SZ', name: 'Schwyz', nameDe: 'Schwyz', nameFr: 'Schwyz', nameIt: 'Svitto', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '6430', primarySector: 'Earthmoving & Quarries' },
  { code: 'OW', name: 'Obwalden', nameDe: 'Obwalden', nameFr: 'Obwald', nameIt: 'Obvaldo', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '6060', primarySector: 'Civil Works & Forestry Machinery' },
  { code: 'NW', name: 'Nidwalden', nameDe: 'Nidwalden', nameFr: 'Nidwald', nameIt: 'Nidvaldo', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '6370', primarySector: 'Infrastructure & Excavation' },
  { code: 'GL', name: 'Glarus', nameDe: 'Glarus', nameFr: 'Glaris', nameIt: 'Glarona', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '8750', primarySector: 'Mountain Civil Engineering' },
  { code: 'ZG', name: 'Zug', nameDe: 'Zug', nameFr: 'Zoug', nameIt: 'Zugo', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '6300', primarySector: 'Commercial Infrastructure' },
  { code: 'FR', name: 'Fribourg', nameDe: 'Freiburg', nameFr: 'Fribourg', nameIt: 'Friburgo', region: 'Romandie (FR)', defaultLanguage: 'fr', language: 'fr', bilingual: ['fr', 'de'], plz: '1700', primarySector: 'Civil Engineering & Gravel Pits' },
  { code: 'SO', name: 'Solothurn', nameDe: 'Solothurn', nameFr: 'Soleure', nameIt: 'Soletta', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '4500', primarySector: 'Industrial Earthworks & Transport' },
  { code: 'BS', name: 'Basel-Stadt', nameDe: 'Basel-Stadt', nameFr: 'Bâle-Ville', nameIt: 'Basilea Città', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '4000', primarySector: 'Rhine Port Logistics & Demolition' },
  { code: 'BL', name: 'Basel-Landschaft', nameDe: 'Basel-Landschaft', nameFr: 'Bâle-Campagne', nameIt: 'Basilea Campagna', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '4410', primarySector: 'Heavy Excavation & Recycling' },
  { code: 'SH', name: 'Schaffhausen', nameDe: 'Schaffhausen', nameFr: 'Schaffhouse', nameIt: 'Sciaffusa', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '8200', primarySector: 'Municipal & Road Equipment' },
  { code: 'AR', name: 'Appenzell Ausserrhoden', nameDe: 'Appenzell Ausserrhoden', nameFr: 'Appenzell Rhodes-Extérieures', nameIt: 'Appenzello Esterno', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '9100', primarySector: 'Regional Earthmoving' },
  { code: 'AI', name: 'Appenzell Innerrhoden', nameDe: 'Appenzell Innerrhoden', nameFr: 'Appenzell Rhodes-Intérieures', nameIt: 'Appenzello Interno', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '9050', primarySector: 'Civil & Utility Contractors' },
  { code: 'SG', name: 'St. Gallen', nameDe: 'St. Gallen', nameFr: 'Saint-Gall', nameIt: 'San Gallo', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '9000', primarySector: 'Tiefbau Rheintal' },
  { code: 'GR', name: 'Graubünden', nameDe: 'Graubünden', nameFr: 'Grisons', nameIt: 'Grigioni', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', bilingual: ['de', 'it'], plz: '7000', primarySector: 'Alpine Civil Engineering & Snow/Earth Fleet' },
  { code: 'AG', name: 'Aargau', nameDe: 'Aargau', nameFr: 'Argovie', nameIt: 'Argovia', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '5000', primarySector: 'Kieswerk & Highway Grading' },
  { code: 'TG', name: 'Thurgau', nameDe: 'Thurgau', nameFr: 'Thurgovie', nameIt: 'Turgovia', region: 'Deutschschweiz (DE)', defaultLanguage: 'de', language: 'de', plz: '8500', primarySector: 'Earthworks & Agricultural/Civil Fleet' },
  { code: 'TI', name: 'Ticino', nameDe: 'Tessin', nameFr: 'Tessin', nameIt: 'Ticino', region: 'Ticino (IT)', defaultLanguage: 'it', language: 'it', plz: '6900', primarySector: 'Genio Civile & Stone Quarries' },
  { code: 'VD', name: 'Vaud', nameDe: 'Waadt', nameFr: 'Vaud', nameIt: 'Vaud', region: 'Romandie (FR)', defaultLanguage: 'fr', language: 'fr', plz: '1000', primarySector: 'Demolition & Mobile Crushing' },
  { code: 'VS', name: 'Valais', nameDe: 'Wallis', nameFr: 'Valais', nameIt: 'Vallese', region: 'Romandie (FR)', defaultLanguage: 'fr', language: 'fr', bilingual: ['fr', 'de'], plz: '1950', primarySector: 'Alpine Earthworks & Tunneling' },
  { code: 'NE', name: 'Neuchâtel', nameDe: 'Neuenburg', nameFr: 'Neuchâtel', nameIt: 'Neuchâtel', region: 'Romandie (FR)', defaultLanguage: 'fr', language: 'fr', plz: '2000', primarySector: 'Jura Earthmoving & Trenching' },
  { code: 'GE', name: 'Genève', nameDe: 'Genf', nameFr: 'Genève', nameIt: 'Ginevra', region: 'Romandie (FR)', defaultLanguage: 'fr', language: 'fr', plz: '1200', primarySector: 'Urban Civil Engineering' },
  { code: 'JU', name: 'Jura', nameDe: 'Jura', nameFr: 'Jura', nameIt: 'Giura', region: 'Romandie (FR)', defaultLanguage: 'fr', language: 'fr', plz: '2800', primarySector: 'Earthmoving & Quarry Operations' },
];

export const SWISS_CANTON_CODES = new Set(ALL_SWISS_CANTONS.map((c) => c.code));

export const CANTON_BY_CODE = new Map<string, SwissCantonMeta>(
  ALL_SWISS_CANTONS.map((c) => [c.code, c])
);

export function normalizeCantonCode(input?: string | null): string {
  if (!input || typeof input !== 'string') return 'VD';
  const cleaned = input.trim().toUpperCase();
  if (SWISS_CANTON_CODES.has(cleaned)) {
    return cleaned;
  }
  const lower = input.trim().toLowerCase();
  for (const canton of ALL_SWISS_CANTONS) {
    if (
      canton.name.toLowerCase() === lower ||
      canton.nameDe.toLowerCase() === lower ||
      canton.nameFr.toLowerCase() === lower ||
      canton.nameIt.toLowerCase() === lower
    ) {
      return canton.code;
    }
  }
  if (cleaned === 'CH') return 'CH';
  return 'VD';
}

export interface ParsedMoney {
  amount: number | null;
  currency: 'CHF' | 'EUR' | 'USD';
  raw: string;
}

const EUR_TO_CHF_RATE = 0.94;
const USD_TO_CHF_RATE = 0.88;

/**
 * Safely parses European / Swiss price strings without inflating decimals.
 */
export function parsePriceString(raw?: string | null): ParsedMoney {
  if (!raw || typeof raw !== 'string') {
    return { amount: null, currency: 'CHF', raw: '' };
  }

  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();
  let currency: 'CHF' | 'EUR' | 'USD' = 'CHF';
  if (upper.includes('EUR') || upper.includes('€')) {
    currency = 'EUR';
  } else if (upper.includes('USD') || upper.includes('$')) {
    currency = 'USD';
  }

  const cleaned = trimmed
    .replace(/\.-\b|\.-$/g, '')
    .replace(/['’`]/g, '');

  const match = cleaned.match(/(\d[\d\s.,]*\d|\d+)/);
  if (!match) {
    return { amount: null, currency, raw: trimmed };
  }

  let numStr = match[1].replace(/\s+/g, '');

  const lastDot = numStr.lastIndexOf('.');
  const lastComma = numStr.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    if (lastDot > lastComma) {
      numStr = numStr.replace(/,/g, '');
    } else {
      numStr = numStr.replace(/\./g, '').replace(',', '.');
    }
  } else if (lastComma !== -1) {
    const afterComma = numStr.slice(lastComma + 1);
    if (afterComma.length === 2 || afterComma.length === 1) {
      numStr = numStr.replace(',', '.');
    } else {
      numStr = numStr.replace(/,/g, '');
    }
  } else if (lastDot !== -1) {
    const afterDot = numStr.slice(lastDot + 1);
    const dotCount = (numStr.match(/\./g) || []).length;
    if (dotCount > 1 || afterDot.length === 3) {
      numStr = numStr.replace(/\./g, '');
    }
  }

  const parsed = Number.parseFloat(numStr);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return { amount: null, currency, raw: trimmed };
  }

  return {
    amount: Math.round(parsed * 100) / 100,
    currency,
    raw: trimmed,
  };
}

export function convertToChf(amount: number | null | undefined, currency: 'CHF' | 'EUR' | 'USD' = 'CHF'): number {
  if (!amount || amount <= 0) return 0;
  if (currency === 'EUR') return Math.round(amount * EUR_TO_CHF_RATE);
  if (currency === 'USD') return Math.round(amount * USD_TO_CHF_RATE);
  return Math.round(amount);
}

export function formatMoney(amount: number | null | undefined, currency: 'CHF' | 'EUR' | 'USD' = 'CHF'): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return 'Price on request';
  }
  return `${currency} ${Math.round(amount).toLocaleString('de-CH')}`;
}

export function localizeEquipmentFocus(focus: string | undefined, targetLang: SwissLanguage): string {
  const raw = (focus || '').trim();
  if (!raw) {
    if (targetLang === 'de') return 'Raupenbagger 15–30t, 4-Achs Kipper, Radlader, Mobilbrecher';
    if (targetLang === 'it') return 'Escavatori cingolati 15–30t, camion 4 assi ribaltabili, pale gommate, frantoi mobili';
    return 'Pelles sur chenilles 15–30t, camions benne 4 essieux, chargeuses sur pneus, concasseurs';
  }

  if (targetLang === 'fr') return raw;

  const dictionary: Array<{ fr: RegExp; de: string; it: string }> = [
    {
      fr: /pelles?\s+sur\s+chenilles?\s*(15[–-]30\s*t)?/gi,
      de: 'Raupenbagger $1',
      it: 'Escavatori cingolati $1',
    },
    {
      fr: /pelles?\s*(15[–-]30\s*t)/gi,
      de: 'Raupenbagger $1',
      it: 'Escavatori $1',
    },
    {
      fr: /mini-pelles?\s*(2[–-]8\s*t)?/gi,
      de: 'Minibagger $1',
      it: 'Miniescavatori $1',
    },
    {
      fr: /camions?\s+bennes?\s*4\s*essieux/gi,
      de: '4-Achs Kipper',
      it: 'Camion 4 assi ribaltabili',
    },
    {
      fr: /camions?\s*4\s*essieux/gi,
      de: '4-Achs Lastwagen / Kipper',
      it: 'Camion 4 assi',
    },
    {
      fr: /chargeuses?\s+sur\s+pneus?/gi,
      de: 'Radlader',
      it: 'Pale gommate',
    },
    {
      fr: /concasseurs?\s+mobiles?/gi,
      de: 'Mobilbrecher',
      it: 'Frantoi mobili',
    },
    {
      fr: /concasseurs?/gi,
      de: 'Brecheranlagen',
      it: 'Frantoi',
    },
    {
      fr: /tombereaux?\s+articul[ée]s?/gi,
      de: 'Knickgelenkte Dumper',
      it: 'Dumper articolati',
    },
    {
      fr: /bulldozers?\s*(&|et)?\s*niveleuses?/gi,
      de: 'Planierraupen & Grader',
      it: 'Bulldozer e motolivellatrici',
    },
  ];

  let result = raw;
  for (const entry of dictionary) {
    result = result.replace(entry.fr, (_, group1) => {
      const replacement = targetLang === 'de' ? entry.de : entry.it;
      return replacement.replace('$1', group1 || '').trim();
    });
  }

  return result.replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim();
}

export function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
