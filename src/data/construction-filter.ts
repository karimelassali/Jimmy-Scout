// Construction-only filter for register data (LINDAS / Zefix purposes).
//
// Why this exists (12 Nov 2026): the first LINDAS harvest filtered purpose
// text on the substring "bau". That also matches Anbau / Gartenbau /
// Pflanzenbau / Weinbau (farming, gardening, viticulture) and the
// boilerplate "überbauen" / "Baurecht" that appears in almost every Swiss
// company purpose — so pest control, fertiliser, agro and a trade union
// slipped into the Pool sample. The rules below fix that class of bug:
//
//   1. VETO terms (checked first, anywhere in name + purpose) reject the
//      company outright — farming, gardening, viticulture, pest control,
//      furniture, curtains/decor, drinks, party services, trade unions,
//      car garages, companies in liquidation.
//   2. A STRONG construction term must appear in the FIRST SENTENCE of the
//      purpose (the main activity — Swiss purposes list it first, then
//      boilerplate) or in the company NAME together with a strong term
//      anywhere in the purpose. That keeps real-estate-only holdings out:
//      their first sentence is about buying/selling property.
//   3. Bare "bau" only counts as a whole word (regex), never as part of
//      "Anbau", "Gartenbau" or "überbauen".
//
// This is the check the Pool sample is verified against (see
// tests/construction-filter.test.ts). The discovery service has its own
// equivalent for website text — see construction-relevance.ts in the worker.

/** Strong construction signals — substrings, lowercased before matching. */
export const CONSTRUCTION_STRONG_TERMS = [
  'hochbau',
  'tiefbau',
  'strassenbau',
  'bauunternehmen',
  'bauunternehmung',
  'baugeschäft',
  'baugewerbe',
  'baubereich',
  'bauwesen',
  'bauwerk',
  'terrassement',
  'génie civil',
  'genie civil',
  'genio civile',
  'entreprise de construction',
  'entreprise générale',
  'entreprise totale',
  'travaux publics',
  'maurer',
  'zimmerei',
  'holzbau',
  'charpente',
  'sanitär',
  'sanitaire',
  'sanitari',
  'elektroinstallation',
  'installations électriques',
  'installations sanitaires',
  'plomberie',
  'baumaschinen',
  'kieswerk',
  'gravière',
  'carrière',
  'steinbruch',
  'baustoffe',
  'béton',
  'betonwerk',
  'betonsanierung',
  'bauabdichtung',
  'flachdach',
  'dachdecker',
  'spenglerei',
  'gerüstbau',
  'échafaudage',
  'démolition',
  'demolizione',
  'abbruch',
  'erdarbeiten',
  'excavation',
  'scavi',
  'impresa di costruzioni',
  'costruzioni edili',
  'impresa edile',
  'tunnelbau',
  'brückenbau',
  'gleisbau',
  'rohrleitungsbau',
  'kanalisation',
  'gipser',
  'plâtrier',
  'malerarbeiten',
  'architektur',
  'innenausbau',
  'schreinerei',
  'isolierung',
  'isolation',
  'isolazione',
];

/** Bare "bau" only as a whole word — never inside Anbau/Gartenbau/überbauen. */
export const BAU_WORD = /(^|[\s(,;:.])bau([\s.,;:)]|$)/i;

/** Off-field activities — any of these anywhere in name + purpose rejects. */
export const CONSTRUCTION_VETO_TERMS = [
  'gartenbau',
  'pflanzenbau',
  'weinbau',
  'landbau',
  'landwirtschaft',
  'agrar',
  'agro',
  'dünger',
  'pflanzenschutz',
  'baumschule',
  'gärtnerei',
  'landschaftsgestaltung',
  'garten- und landschaft',
  'pest control',
  'schädlingsbekämpfung',
  'entwesung',
  'desinfiz',
  'berufsorganisation',
  'gewerkschaft',
  'arbeitnehmer',
  'möbel',
  'vorhänge',
  'vorhang',
  'rideaux',
  'gardinen',
  'voilages',
  'getränke',
  'boissons',
  'brauerei',
  'weinhandel',
  'party',
  'catering',
  'fête',
  'événementiel',
  'tankstelle',
  'garageunternehmen',
  'autoreparatur',
  'autohandel',
  'automobilien',
  'carrosserie',
  'autospenglerei',
  'liquidation',
];

/** Name tokens that mark an association/cooperative, never a contractor. */
export const CONSTRUCTION_NAME_VETO_TOKENS = new Set([
  'verein',
  'verband',
  'genossenschaft',
]);

/** Main activity = the first sentence of the purpose (up to 250 chars). */
export function firstPurposeSentence(purpose: string): string {
  const text = purpose.trim();
  const end = text.search(/\.(\s|$)/);
  if (end === -1) return text.slice(0, 250);
  return text.slice(0, end + 1);
}

function hasStrongTerm(text: string): boolean {
  const lower = text.toLowerCase();
  if (CONSTRUCTION_STRONG_TERMS.some((term) => lower.includes(term))) return true;
  return BAU_WORD.test(text);
}

export function isConstructionCompany(name: string, purpose: string): boolean {
  const text = `${name} ${purpose}`.toLowerCase();
  if (CONSTRUCTION_VETO_TERMS.some((term) => text.includes(term))) return false;
  const tokens = name
    .toLowerCase()
    .split(/[\s\-]+/)
    .filter(Boolean);
  if (tokens.some((token) => CONSTRUCTION_NAME_VETO_TOKENS.has(token))) return false;
  if (hasStrongTerm(firstPurposeSentence(purpose))) return true;
  if (hasStrongTerm(name) && hasStrongTerm(purpose)) return true;
  return false;
}
