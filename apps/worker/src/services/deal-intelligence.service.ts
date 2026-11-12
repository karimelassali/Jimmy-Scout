import { InboundLead, DetectedMachinery } from '@/packages/types/src/lead.ts';
import { WatchlistRule } from '@/packages/types/src/database.ts';
import { supabaseDataService } from './supabase.service.ts';
import { convertToChf, parsePriceString } from '@/packages/types/src/swiss.ts';

const currentYear = () => new Date().getUTCFullYear();

function machinePrice(machine?: DetectedMachinery): number | null {
  const value = machine?.asking_price_chf ?? machine?.asking_price_amount;
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
}

function normalizedWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9à-ÿ]+/g, ' ')
    .split(' ')
    .filter((word) => word.length > 2);
}

function similar(a?: DetectedMachinery, b?: DetectedMachinery): boolean {
  if (!a || !b) return false;
  const left = new Set(normalizedWords(`${a.type} ${a.make_model}`));
  return normalizedWords(`${b.type} ${b.make_model}`).some((word) => left.has(word));
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function heuristicValue(machine?: DetectedMachinery): number {
  const age = machine?.year ? Math.max(0, currentYear() - machine.year) : 10;
  const hours = machine?.hours ?? 7000;
  const name = `${machine?.type || ''} ${machine?.make_model || ''}`.toLowerCase();
  const base = /crusher|concasseur|brecher/.test(name)
    ? 160000
    : /truck|camion|lkw|benne/.test(name)
      ? 115000
      : /loader|chargeuse|radlader/.test(name)
        ? 145000
        : 135000;
  return Math.max(18000, base * Math.pow(0.9, age) * Math.max(0.42, 1 - hours / 30000));
}

function matchesWatchlist(machine: DetectedMachinery | undefined, canton: string, rule: WatchlistRule): boolean {
  if (!machine || !rule.enabled) return false;
  const text = `${machine.type} ${machine.make_model}`.toLowerCase();
  if (rule.keywords.length && !rule.keywords.some((word) => text.includes(word.toLowerCase()))) return false;
  if (rule.cantons.length && !rule.cantons.includes(canton)) return false;
  if (rule.min_year && (!machine.year || machine.year < rule.min_year)) return false;
  if (rule.max_hours && (!machine.hours || machine.hours > rule.max_hours)) return false;
  const price = machinePrice(machine);
  if (rule.max_price_chf && (!price || price > rule.max_price_chf)) return false;
  return true;
}

function qualificationDraft(lead: InboundLead, missing: string[]): { subject: string; body: string } {
  const machine = lead.machinery_detected[0];
  const label = machine?.make_model || machine?.type || 'la machine';
  return {
    subject: `Quelques informations sur ${label}`,
    body: `Bonjour${lead.contact_name ? ` ${lead.contact_name}` : ''},\n\nMerci pour votre réponse. Pour étudier rapidement ${label}, pouvez-vous nous envoyer :\n${missing.map((item) => `- ${item}`).join('\n')}\n\nDes photos récentes sont aussi utiles.\n\nMerci et bonne journée.`,
  };
}

export interface OfferPriceSummary {
  /** Converted total, in CHF — the "Valeur totale des offres" figure. */
  total_chf: number;
  /** Machines with a usable price. */
  offers_count: number;
  /** Offers originally priced in a foreign currency and converted to CHF. */
  converted_count: number;
  /** Converted (non-CHF) part of total_chf. */
  converted_total_chf: number;
  /** Original amounts per currency, so the screen can label the mix. */
  by_currency: Array<{ currency: 'CHF' | 'EUR' | 'USD'; count: number; total_amount: number }>;
  /** French one-liner for the screen, e.g. "dont 1 offre en EUR convertie…". */
  note: string;
}

/**
 * Aggregate asking prices across leads exactly the way the Home screen sums
 * them (stored asking_price_chf first, raw asking price parsed + converted
 * as a fallback), but keep the original currency and amount alongside the
 * converted CHF total so the screen can explain the mix instead of showing
 * one bare CHF figure. EUR→CHF 0.94 / USD→CHF 0.88 are the fixed rates in
 * packages/types/src/swiss.ts.
 */
export function summarizeOfferPrices(leads: InboundLead[]): OfferPriceSummary {
  let total_chf = 0;
  let offers_count = 0;
  let converted_count = 0;
  let converted_total_chf = 0;
  const byCurrency = new Map<
    'CHF' | 'EUR' | 'USD',
    { currency: 'CHF' | 'EUR' | 'USD'; count: number; total_amount: number }
  >();
  const convertedCurrencies = new Set<string>();

  for (const lead of leads) {
    for (const machine of lead.machinery_detected || []) {
      let chf: number | null =
        typeof machine.asking_price_chf === 'number' && machine.asking_price_chf > 0
          ? machine.asking_price_chf
          : null;
      let currency = machine.asking_price_currency as 'CHF' | 'EUR' | 'USD' | undefined;
      let amount = machine.asking_price_amount ?? null;
      if (chf === null && machine.asking_price) {
        const parsed = parsePriceString(machine.asking_price);
        amount = parsed.amount;
        currency = parsed.currency;
        chf = convertToChf(parsed.amount, parsed.currency);
      }
      if (!chf || chf <= 0) continue;
      const originalCurrency = currency || 'CHF';
      offers_count++;
      total_chf += chf;
      if (originalCurrency !== 'CHF') {
        converted_count++;
        converted_total_chf += chf;
        convertedCurrencies.add(originalCurrency);
      }
      const bucket = byCurrency.get(originalCurrency) || {
        currency: originalCurrency,
        count: 0,
        total_amount: 0,
      };
      bucket.count++;
      bucket.total_amount += amount ?? chf;
      byCurrency.set(originalCurrency, bucket);
    }
  }

  const note =
    converted_count > 0
      ? `Total en CHF ; dont ${converted_count} offre${
          converted_count > 1 ? 's' : ''
        } en ${Array.from(convertedCurrencies).join(' / ')} convertie${
          converted_count > 1 ? 's' : ''
        } en CHF (taux fixe EUR→CHF 0,94, USD→CHF 0,88).`
      : 'Total en CHF ; aucune offre en devise étrangère.';
  return {
    total_chf,
    offers_count,
    converted_count,
    converted_total_chf,
    by_currency: Array.from(byCurrency.values()).sort((a, b) =>
      a.currency.localeCompare(b.currency)
    ),
    note,
  };
}

export class DealIntelligenceService {
  async enrichLead(lead: InboundLead): Promise<InboundLead> {
    const [allLeads, logs, watchlists, settings] = await Promise.all([
      supabaseDataService.getLeads(true),
      supabaseDataService.getOutboundLogs(),
      supabaseDataService.getWatchlists(),
      supabaseDataService.getSettings(),
    ]);
    const machine = lead.machinery_detected[0];
    const asking = machinePrice(machine);
    const comparablePrices = allLeads
      .filter((item) => item.id !== lead.id && similar(machine, item.machinery_detected[0]))
      .map((item) => machinePrice(item.machinery_detected[0]))
      .filter((value): value is number => value !== null);
    const center = comparablePrices.length >= 2 ? median(comparablePrices) : heuristicValue(machine);
    const spread = comparablePrices.length >= 4 ? 0.13 : comparablePrices.length >= 2 ? 0.18 : 0.25;
    const low = Math.round((center * (1 - spread)) / 500) * 500;
    const high = Math.round((center * (1 + spread)) / 500) * 500;

    const missing: string[] = [];
    if (!machine?.year) missing.push("l'année");
    if (!machine?.hours) missing.push("le nombre d'heures");
    if (!asking) missing.push('le prix demandé');
    if (!machine?.serial_number) missing.push('le numéro de série');
    if (!machine?.condition) missing.push("l'état général");
    if (!lead.contact_phone) missing.push('un numéro de téléphone');

    const watchlistMatches = watchlists
      .filter((rule) => matchesWatchlist(machine, lead.canton || 'CH', rule))
      .map((rule) => rule.name);
    const sellerLeads = allLeads.filter((item) => item.sender_email.toLowerCase() === lead.sender_email.toLowerCase());
    const sellerLogs = logs.filter((item) => item.recipient_email?.toLowerCase() === lead.sender_email.toLowerCase());
    const positive = sellerLeads.filter((item) => item.intent === 'HOT_LEAD').length;
    const bounced = sellerLogs.filter((item) => item.delivery_status === 'bounced' || item.delivery_status === 'failed').length;
    const sellerScore = Math.max(10, Math.min(100, 55 + positive * 12 - bounced * 20 + (lead.contact_phone ? 8 : 0)));

    let score = 30;
    const reasons: string[] = [];
    if (machine) { score += 12; reasons.push('machine reconnue'); }
    if (machine?.year) score += machine.year >= currentYear() - 10 ? 12 : 6;
    if (machine?.hours) score += machine.hours <= 8000 ? 12 : 5;
    if (asking) {
      if (asking <= low) { score += 18; reasons.push('prix sous la valeur estimée'); }
      else if (asking <= high) { score += 10; reasons.push('prix dans le marché estimé'); }
      else reasons.push('prix au-dessus du marché estimé');
    }
    if (watchlistMatches.length) { score += 10; reasons.push(`liste trouvée : ${watchlistMatches.join(', ')}`); }
    if (sellerScore >= 70) { score += 6; reasons.push('vendeur avec de bons signaux'); }
    score -= Math.min(18, missing.length * 3);
    score = Math.max(0, Math.min(100, score));

    const maxOffer = Math.round((Math.min(asking || high, center * 0.84)) / 500) * 500;
    const opening = Math.round((maxOffer * 0.88) / 500) * 500;
    const qualification = qualificationDraft(lead, missing);
    const negotiationDraft = `Bonjour${lead.contact_name ? ` ${lead.contact_name}` : ''},\n\nMerci pour les informations. Après étude de ${machine?.make_model || 'la machine'}, nous pouvons proposer CHF ${opening.toLocaleString('fr-CH')}, avec une décision rapide et le transport organisé par nos soins.\n\nCette offre reste soumise à la vérification de la machine et de ses documents.\n\nMeilleures salutations.`;

    return {
      ...lead,
      deal_score: settings.feature_controls.deal_scoring === 'off' ? undefined : score,
      deal_score_reasons: settings.feature_controls.deal_scoring === 'off' ? [] : reasons,
      market_price_low_chf: settings.feature_controls.price_comparison === 'off' ? null : low,
      market_price_high_chf: settings.feature_controls.price_comparison === 'off' ? null : high,
      market_price_confidence: settings.feature_controls.price_comparison === 'off' ? undefined : comparablePrices.length >= 4 ? 'high' : comparablePrices.length >= 2 ? 'medium' : 'low',
      market_price_basis: settings.feature_controls.price_comparison === 'off' ? undefined : comparablePrices.length >= 2
        ? `${comparablePrices.length} dossiers comparables internes`
        : 'estimation prudente selon âge, heures et type de machine',
      estimated_margin_chf: settings.feature_controls.price_comparison === 'off' || !asking ? null : Math.round(center - asking),
      missing_information: missing,
      qualification_subject: qualification.subject,
      qualification_draft: missing.length ? qualification.body : null,
      negotiation_opening_chf: settings.feature_controls.negotiation === 'off' ? null : opening,
      negotiation_max_chf: settings.feature_controls.negotiation === 'off' ? null : maxOffer,
      negotiation_draft: settings.feature_controls.negotiation === 'off' ? null : negotiationDraft,
      watchlist_matches: watchlistMatches,
      seller_reliability_score: settings.feature_controls.seller_intelligence === 'off' ? undefined : sellerScore,
      seller_history_summary: settings.feature_controls.seller_intelligence === 'off' ? undefined : `${sellerLeads.length} réponse(s), ${positive} offre(s) utile(s), ${bounced} échec(s) d’envoi`,
    };
  }
}

export const dealIntelligenceService = new DealIntelligenceService();
