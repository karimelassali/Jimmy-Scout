import dns from 'node:dns/promises';
import net from 'node:net';
import { config } from '../config/env.ts';
import { CANTON_BY_CODE } from '@/packages/types/src/swiss.ts';
import { getLanguageForCanton } from '../scheduler.ts';
import {
  DiscoveryRecord,
  DiscoverySchedulerStatus,
} from '@/packages/types/src/database.ts';
import { supabaseDataService } from './supabase.service.ts';

interface PlaceCandidate {
  id: string;
  name: string;
  website?: string | null;
  phone?: string | null;
  address?: string | null;
  businessStatus?: string | null;
  types?: string[];
  stubEmail?: string | null;
}

export interface DiscoveryStepResult {
  status: 'completed' | 'paused' | 'waiting' | 'quota_reached' | 'blocked' | 'busy' | 'error';
  message: string;
  query?: string;
  canton?: string;
  scanned?: number;
  ready?: number;
  missingEmail?: number;
  duplicates?: number;
  rejected?: number;
  nextRunAt?: string | null;
}

const RELEVANCE_TERMS = [
  'tiefbau', 'terrassement', 'excavation', 'erdarbeiten', 'demolition', 'démolition',
  'abbruch', 'bauunternehmen', 'construction', 'genio civile', 'baumaschinen',
  'machine de chantier', 'gravière', 'kieswerk', 'carrière', 'quarry', 'recycling',
];

const CONTACT_HINTS = ['contact', 'kontakt', 'contatto', 'impressum', 'mentions-legales', 'about'];

function normalizeHost(value?: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function isPrivateIp(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a, b] = address.split('.').map(Number);
    return (
      a === 10 || a === 127 || a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const lower = address.toLowerCase();
  return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
}

async function assertPublicUrl(rawUrl: string): Promise<URL> {
  const url = new URL(rawUrl);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported website protocol');
  if (url.username || url.password) throw new Error('Credentialed website URLs are not allowed');
  const host = url.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.local') || net.isIP(host)) {
    if (!net.isIP(host) || isPrivateIp(host)) throw new Error('Private website address rejected');
  }
  const addresses = await dns.lookup(host, { all: true });
  if (!addresses.length || addresses.some((item) => isPrivateIp(item.address))) {
    throw new Error('Website resolved to a private address');
  }
  return url;
}

async function fetchPublicHtml(rawUrl: string, redirectCount = 0): Promise<{ html: string; url: URL }> {
  const url = await assertPublicUrl(rawUrl);
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(8_000),
    headers: {
      Accept: 'text/html,application/xhtml+xml',
      'User-Agent': 'JimiScoutCompanyDiscovery/1.0 (+https://jimyexport.ch)',
    },
  });
  if (response.status >= 300 && response.status < 400) {
    if (redirectCount >= 2) throw new Error('Too many website redirects');
    const location = response.headers.get('location');
    if (!location) throw new Error('Website redirect had no destination');
    return fetchPublicHtml(new URL(location, url).toString(), redirectCount + 1);
  }
  if (!response.ok) throw new Error(`Website returned HTTP ${response.status}`);
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
    throw new Error('Website did not return HTML');
  }
  const html = (await response.text()).slice(0, 600_000);
  return { html, url };
}

function extractEmails(html: string): string[] {
  const decoded = html
    .replace(/&#64;|\[at\]|\(at\)/gi, '@')
    .replace(/&#46;|\[dot\]|\(dot\)/gi, '.');
  const matches = decoded.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) || [];
  return Array.from(new Set(matches.map((email) => email.toLowerCase())))
    .filter((email) => !/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(email))
    .filter((email) => !email.includes('example.com'))
    .slice(0, 20);
}

function selectBestEmail(emails: string[], websiteHost: string): string | null {
  if (!emails.length) return null;
  const score = (email: string) => {
    const [local, domain = ''] = email.split('@');
    let value = domain.replace(/^www\./, '') === websiteHost ? 10 : 0;
    if (/^(info|contact|kontakt|office|bureau|commercial|verkauf|admin|hello)$/.test(local)) value += 5;
    if (/^(noreply|no-reply|privacy|datenschutz|webmaster)$/.test(local)) value -= 8;
    return value;
  };
  return [...emails].sort((a, b) => score(b) - score(a))[0] || null;
}

function extractContactLinks(html: string, baseUrl: URL): string[] {
  const links: string[] = [];
  const hrefPattern = /href=["']([^"'#]+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefPattern.exec(html))) {
    try {
      const candidate = new URL(match[1], baseUrl);
      if (
        candidate.origin === baseUrl.origin &&
        CONTACT_HINTS.some((hint) => candidate.pathname.toLowerCase().includes(hint))
      ) {
        links.push(candidate.toString());
      }
    } catch {}
  }
  return Array.from(new Set(links)).slice(0, 2);
}

async function findPublicBusinessEmail(website: string): Promise<{
  email: string | null;
  evidenceUrl: string | null;
  text: string;
}> {
  const first = await fetchPublicHtml(website);
  const host = first.url.hostname.toLowerCase().replace(/^www\./, '');
  let emails = extractEmails(first.html);
  let evidenceUrl = emails.length ? first.url.toString() : null;
  let combinedText = first.html.replace(/<[^>]+>/g, ' ').slice(0, 20_000);

  if (!emails.length) {
    for (const link of extractContactLinks(first.html, first.url)) {
      try {
        const contact = await fetchPublicHtml(link);
        const found = extractEmails(contact.html);
        combinedText += ` ${contact.html.replace(/<[^>]+>/g, ' ').slice(0, 12_000)}`;
        if (found.length) {
          emails = found;
          evidenceUrl = contact.url.toString();
          break;
        }
      } catch {}
    }
  }

  return { email: selectBestEmail(emails, host), evidenceUrl, text: combinedText };
}

function relevanceScore(place: PlaceCandidate, websiteText: string): { score: number; reason: string } {
  const haystack = `${place.name} ${(place.types || []).join(' ')} ${websiteText}`.toLowerCase();
  const matches = RELEVANCE_TERMS.filter((term) => haystack.includes(term));
  const score = Math.min(0.97, 0.52 + Math.min(0.36, matches.length * 0.09) + (place.website ? 0.05 : 0));
  return {
    score,
    reason: matches.length
      ? `Matched contractor signals: ${matches.slice(0, 4).join(', ')}`
      : 'Found by a targeted contractor search, but website evidence was weak.',
  };
}

export class CompanyDiscoveryService {
  private timerHandle: NodeJS.Timeout | null = null;
  private running = false;

  private providerConfigured(): boolean {
    return Boolean(
      config.googlePlaces.apiKey || config.foursquare.apiKey || config.openStreetMap.overpassUrl ||
      (config.zefix.username && config.zefix.password) || process.env.JIMISCOUT_STUB_EXTERNAL === 'true'
    );
  }

  private async searchFoursquare(query: string, cantonName: string): Promise<PlaceCandidate[]> {
    if (!config.foursquare.apiKey) return [];
    // Railway values are sometimes pasted as `Bearer <key>` or with quotes.
    // Normalize both forms before constructing the Authorization header.
    const serviceKey = config.foursquare.apiKey
      .trim()
      .replace(/^Bearer\s+/i, '')
      .replace(/^['"]|['"]$/g, '');
    const params = new URLSearchParams({ query, near: `${cantonName}, Switzerland`, limit: '20', fields: 'fsq_place_id,name,location,tel,website,categories' });
    const response = await fetch(`https://places-api.foursquare.com/places/search?${params}`, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${serviceKey}`,
        'X-Places-Api-Version': '2025-06-17',
      },
    });
    if (!response.ok) throw new Error(`Foursquare search failed (${response.status})`);
    const payload = (await response.json()) as any;
    return (Array.isArray(payload.results) ? payload.results : []).map((place: any) => ({
      id: `fsq:${place.fsq_place_id}`, name: String(place.name || '').trim(), website: place.website || null,
      phone: place.tel || null, address: place.location?.formatted_address || null,
      businessStatus: null, types: (place.categories || []).map((c: any) => c.name),
    })).filter((place: PlaceCandidate) => place.id && place.name);
  }

  private async searchOpenStreetMap(query: string, cantonCode: string): Promise<PlaceCandidate[]> {
    if (!config.openStreetMap.overpassUrl) return [];
    const keyword = query.split(' ')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const areaCode = `CH-${cantonCode}`;
    const overpassQuery = `[out:json][timeout:25];area["ISO3166-2"="${areaCode}"][admin_level=4]->.searchArea;(nwr["name"~"${keyword}",i](area.searchArea);nwr["office"="company"](area.searchArea););out center tags;`;
    const response = await fetch(config.openStreetMap.overpassUrl, {
      method: 'POST', signal: AbortSignal.timeout(30_000), headers: { 'Content-Type': 'text/plain', Accept: 'application/json' }, body: overpassQuery,
    });
    if (!response.ok) throw new Error(`OpenStreetMap search failed (${response.status})`);
    const payload = (await response.json()) as any;
    return (Array.isArray(payload.elements) ? payload.elements : []).map((element: any) => {
      const tags = element.tags || {};
      const address = [tags['addr:street'], tags['addr:housenumber'], tags['addr:postcode'], tags['addr:city']].filter(Boolean).join(' ');
      return { id: `osm:${element.type}/${element.id}`, name: String(tags.name || '').trim(), website: tags.website || tags['contact:website'] || null,
        phone: tags.phone || tags['contact:phone'] || null, address: address || null, businessStatus: null,
        types: [tags.shop, tags.office, tags.industrial, tags.description].filter(Boolean) } as PlaceCandidate;
    }).filter((place: PlaceCandidate) => place.name);
  }

  private async verifyWithZefix(name: string): Promise<boolean> {
    if (!config.zefix.username || !config.zefix.password) return true;
    const auth = Buffer.from(`${config.zefix.username}:${config.zefix.password}`).toString('base64');
    const response = await fetch('https://www.zefix.admin.ch/ZefixPublicREST/api/v1/company/search', {
      method: 'POST', signal: AbortSignal.timeout(12_000), headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ name, activeOnly: true, maxEntries: 5 }),
    });
    if (response.status === 404) return false;
    if (!response.ok) throw new Error(`Zefix verification failed (${response.status})`);
    const payload = (await response.json()) as any;
    return Array.isArray(payload) ? payload.length > 0 : Boolean(payload?.companies?.length || payload?.entries?.length);
  }

  private async searchPlaces(query: string, cantonCode = 'ZH'): Promise<PlaceCandidate[]> {
    if (process.env.JIMISCOUT_STUB_EXTERNAL === 'true') {
      return [
        {
          id: `stub-${query.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`,
          name: 'Stub Tiefbau AG',
          website: 'https://stub-tiefbau.example',
          phone: '+41 44 000 00 00',
          address: 'Teststrasse 1, 8000 Zürich',
          businessStatus: 'OPERATIONAL',
          types: ['general_contractor'],
          stubEmail: 'info@stub-tiefbau.example',
        },
      ];
    }

    const providers = await Promise.all([
      this.searchFoursquare(query, query.split(' ').slice(-2, -1)[0] || 'Switzerland'),
      this.searchOpenStreetMap(query, cantonCode),
    ]);
    const alternativeResults = providers.flat();
    if (!config.googlePlaces.apiKey) return alternativeResults;
    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      signal: AbortSignal.timeout(15_000),
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.googlePlaces.apiKey,
        'X-Goog-FieldMask': [
          'places.id', 'places.displayName', 'places.formattedAddress', 'places.websiteUri',
          'places.nationalPhoneNumber', 'places.businessStatus', 'places.types',
        ].join(','),
      },
      body: JSON.stringify({ textQuery: query, regionCode: 'CH', pageSize: 8 }),
    });
    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`Google Places search failed (${response.status}): ${detail}`);
    }
    const payload = (await response.json()) as any;
    const googleResults = (Array.isArray(payload.places) ? payload.places : []).map((place: any) => ({
      id: String(place.id || ''),
      name: String(place.displayName?.text || '').trim(),
      website: place.websiteUri || null,
      phone: place.nationalPhoneNumber || null,
      address: place.formattedAddress || null,
      businessStatus: place.businessStatus || null,
      types: Array.isArray(place.types) ? place.types : [],
    })).filter((place: PlaceCandidate) => place.id && place.name);
    return [...googleResults, ...alternativeResults];
  }

  async getStatus(referenceDate = new Date()): Promise<DiscoverySchedulerStatus> {
    const [settings, meta, stats] = await Promise.all([
      supabaseDataService.getSettings(),
      supabaseDataService.getDiscoveryMeta(),
      supabaseDataService.getDiscoveryStats(referenceDate),
    ]);
    let state: DiscoverySchedulerStatus['state'] = 'paused';
    if (!settings.is_active || !settings.discovery_active) state = 'paused';
    else if (!this.providerConfigured()) state = 'blocked';
    else if (meta.last_error) state = 'failed';
    else if (stats.found_today >= settings.discovery_daily_limit) state = 'quota_reached';
    else if (this.running) state = 'running';
    else if (meta.next_run_at && new Date(meta.next_run_at).getTime() > referenceDate.getTime()) state = 'waiting';
    else state = 'enabled';
    return {
      state,
      provider_configured: this.providerConfigured(),
      ...stats,
      last_run_at: meta.last_run_at || null,
      next_run_at: meta.next_run_at || null,
      last_error: meta.last_error || null,
      last_canton: meta.last_canton || null,
    };
  }

  async executeStep(options?: { manualOverride?: boolean; referenceDate?: Date }): Promise<DiscoveryStepResult> {
    if (this.running) return { status: 'busy', message: 'A discovery run is already in progress.' };
    this.running = true;
    const now = options?.referenceDate || new Date();
    try {
      const [settings, meta, stats] = await Promise.all([
        supabaseDataService.getSettings(),
        supabaseDataService.getDiscoveryMeta(),
        supabaseDataService.getDiscoveryStats(now),
      ]);
      // A deliberate one-off dashboard search is useful while the autonomous
      // agent is paused. Scheduled discovery still requires both switches.
      if ((!settings.is_active || !settings.discovery_active) && !options?.manualOverride) {
        return { status: 'paused', message: 'Enable Jimy and Company Discovery first.' };
      }
      if (!this.providerConfigured()) {
        return { status: 'blocked', message: 'Configure at least one discovery provider (Google, Foursquare, or a managed OpenStreetMap endpoint).' };
      }
      if (stats.found_today >= settings.discovery_daily_limit) {
        return { status: 'quota_reached', message: `Discovery daily limit reached (${stats.found_today}/${settings.discovery_daily_limit}).` };
      }
      if (!options?.manualOverride && meta.next_run_at && new Date(meta.next_run_at).getTime() > now.getTime()) {
        return { status: 'waiting', message: 'Waiting for the next scheduled discovery run.', nextRunAt: meta.next_run_at };
      }

      const cantons = settings.selected_cantons.length ? settings.selected_cantons : ['ZH'];
      const keywords = settings.discovery_keywords.length ? settings.discovery_keywords : ['Tiefbauunternehmen'];
      const cantonIndex = (meta.canton_cursor || 0) % cantons.length;
      const keywordIndex = (meta.keyword_cursor || 0) % keywords.length;
      const cantonCode = cantons[cantonIndex];
      const canton = CANTON_BY_CODE.get(cantonCode);
      const query = `${keywords[keywordIndex]} ${canton?.name || cantonCode} Schweiz`;
      const places = await this.searchPlaces(query, cantonCode);
      const companies = await supabaseDataService.getCompanies();
      let ready = 0;
      let missingEmail = 0;
      let duplicates = 0;
      let rejected = 0;

      for (const place of places.slice(0, Math.max(0, settings.discovery_daily_limit - stats.found_today))) {
        const source: DiscoveryRecord['source'] = process.env.JIMISCOUT_STUB_EXTERNAL === 'true'
          ? 'stub'
          : place.id.startsWith('fsq:') ? 'foursquare'
            : place.id.startsWith('osm:') ? 'openstreetmap' : 'google_places';
        if (await supabaseDataService.hasDiscoverySource(source, place.id)) {
          duplicates++;
          await supabaseDataService.addDiscoveryRecord({
            source,
            source_id: `${place.id}#duplicate#${now.toISOString()}`,
            company_name: place.name,
            canton: cantonCode,
            website: place.website || null,
            phone: place.phone || null,
            address: place.address || null,
            status: 'duplicate',
            confidence: 1,
            reason: 'Previously discovered from the same provider record.',
            query,
          });
          continue;
        }
        if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') {
          rejected++;
          await supabaseDataService.addDiscoveryRecord({
            source, source_id: place.id, company_name: place.name, canton: cantonCode,
            website: place.website || null, phone: place.phone || null, address: place.address || null,
            status: 'rejected', confidence: 0.2, reason: `Business status is ${place.businessStatus}.`, query,
          });
          continue;
        }

        if (source !== 'stub' && !(await this.verifyWithZefix(place.name))) {
          rejected++;
          await supabaseDataService.addDiscoveryRecord({
            source, source_id: place.id, company_name: place.name, canton: cantonCode,
            website: place.website || null, phone: place.phone || null, address: place.address || null,
            status: 'rejected', confidence: 0.3, reason: 'No active matching Swiss legal entity found in Zefix.', query,
          });
          continue;
        }

        let email = place.stubEmail || null;
        let evidenceUrl: string | null = place.stubEmail ? place.website || null : null;
        let websiteText = '';
        if (!email && place.website) {
          try {
            const found = await findPublicBusinessEmail(place.website);
            email = found.email;
            evidenceUrl = found.evidenceUrl;
            websiteText = found.text;
          } catch {}
        }
        const relevance = relevanceScore(place, websiteText);
        if (relevance.score < 0.65) {
          rejected++;
          await supabaseDataService.addDiscoveryRecord({
            source, source_id: place.id, company_name: place.name, canton: cantonCode,
            website: place.website || null, email, phone: place.phone || null, address: place.address || null,
            status: 'rejected', confidence: relevance.score, reason: relevance.reason,
            evidence_url: evidenceUrl, query,
          });
          continue;
        }
        if (!email) {
          missingEmail++;
          await supabaseDataService.addDiscoveryRecord({
            source, source_id: place.id, company_name: place.name, canton: cantonCode,
            website: place.website || null, phone: place.phone || null, address: place.address || null,
            status: 'missing_email', confidence: relevance.score,
            reason: `${relevance.reason} No public business email was found.`, query,
          });
          continue;
        }

        const host = normalizeHost(place.website);
        const existing = companies.find((company) =>
          company.email.toLowerCase() === email!.toLowerCase() ||
          Boolean(host && normalizeHost(company.website || company.domain) === host)
        );
        if (existing) {
          duplicates++;
          await supabaseDataService.addDiscoveryRecord({
            source, source_id: place.id, company_id: existing.id, company_name: place.name,
            canton: cantonCode, website: place.website || null, email, phone: place.phone || null,
            address: place.address || null, status: 'duplicate', confidence: relevance.score,
            reason: 'Matched an existing company by email or website domain.', evidence_url: evidenceUrl, query,
          });
          continue;
        }

        const company = await supabaseDataService.addCompany({
          name: place.name,
          email,
          verified_email: true,
          canton: cantonCode,
          language: getLanguageForCanton(cantonCode),
          phone: place.phone || null,
          domain: host,
          website: place.website || null,
          email_source_url: evidenceUrl,
          source,
          source_id: place.id,
          confidence: relevance.score,
          address: place.address || null,
          industry: 'civil_engineering',
          notes: `Autonomously discovered. ${relevance.reason}`,
          discovered_at: now.toISOString(),
          last_contacted_at: null,
        });
        ready++;
        await supabaseDataService.addDiscoveryRecord({
          source, source_id: place.id, company_id: company.id, company_name: place.name,
          canton: cantonCode, website: place.website || null, email, phone: place.phone || null,
          address: place.address || null, status: 'ready', confidence: relevance.score,
          reason: relevance.reason, evidence_url: evidenceUrl, query,
        });
      }

      const nextRunAt = new Date(now.getTime() + settings.discovery_interval_minutes * 60_000).toISOString();
      await supabaseDataService.updateDiscoveryMeta({
        last_run_at: now.toISOString(), next_run_at: nextRunAt, last_error: null,
        last_canton: cantonCode, canton_cursor: cantonIndex + 1,
        keyword_cursor: cantonIndex + 1 >= cantons.length ? keywordIndex + 1 : keywordIndex,
      });
      return {
        status: 'completed',
        message: `Scanned ${places.length} businesses; ${ready} ready for outreach.`,
        query, canton: cantonCode, scanned: places.length, ready, missingEmail,
        duplicates, rejected, nextRunAt,
      };
    } catch (error: any) {
      const message = error?.message || 'Company discovery failed.';
      await supabaseDataService.updateDiscoveryMeta({
        last_run_at: now.toISOString(), last_error: message,
        next_run_at: new Date(now.getTime() + 30 * 60_000).toISOString(),
      });
      return { status: 'error', message };
    } finally {
      this.running = false;
    }
  }

  startDaemonLoop(intervalMs = 5 * 60_000): void {
    if (this.timerHandle) return;
    this.timerHandle = setInterval(() => {
      void this.executeStep().catch((error) =>
        console.warn('[Discovery] Background tick notice:', error?.message)
      );
    }, intervalMs);
  }

  stopDaemonLoop(): void {
    if (this.timerHandle) clearInterval(this.timerHandle);
    this.timerHandle = null;
  }
}

export const companyDiscoveryService = new CompanyDiscoveryService();
