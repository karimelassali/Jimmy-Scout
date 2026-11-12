import test from 'node:test';
import assert from 'node:assert/strict';

// Force isolated in-memory storage and external service stubs BEFORE importing app modules
process.env.JIMISCOUT_STUB_EXTERNAL = 'true';
process.env.JIMISCOUT_USE_MEMORY_ONLY = 'true';
process.env.JIMISCOUT_DISABLE_DAEMON = 'true';
process.env.JIMISCOUT_ADMIN_TOKEN = 'test-admin-token';
process.env.WEBHOOK_SECRET = 'test-webhook-secret';

import { generateFrTemplate } from '../apps/worker/src/templates/fr.template.ts';
import { generateDeTemplate } from '../apps/worker/src/templates/de.template.ts';
import { generateItTemplate } from '../apps/worker/src/templates/it.template.ts';
import { stripUnreplacedPlaceholders } from '../apps/worker/src/services/smtp.service.ts';
import { extractLatestReplyText } from '../apps/worker/src/services/imap.service.ts';
import {
  AI_UNAVAILABLE_SUMMARY,
  personalizeUnavailableSummary,
  resolveChatFallbackNavigate,
} from '../apps/worker/src/services/gemini.service.ts';
import { matchCompanyFromSubject } from '../apps/worker/src/services/inbound.service.ts';
import { summarizeOfferPrices } from '../apps/worker/src/services/deal-intelligence.service.ts';
import { supabaseDataService } from '../apps/worker/src/services/supabase.service.ts';
import { inboundService } from '../apps/worker/src/services/inbound.service.ts';
import { app } from '../server.ts';

// QA fixes 2026-11-12 (issues 6, 9, 15, 18, 19, 20, 23 + Zefix "Fond" + chat
// navigate + template signatures). Pure helpers first, then the live
// end-to-end checks against the real stored data shapes.

const BASE_PARAMS = {
  companyName: 'Müller Bau AG',
  canton: 'ZH',
  senderName: 'Jamal',
  senderEmail: 'info@jimyexport.ch',
  senderPhone: '+41 79 123 45 67',
  hooks: { cash_settlement: true, transport_covered: true, as_is: true },
  equipmentFocus: 'Pelles sur chenilles 15–30t, camions benne 4 essieux',
};

test('9. Outreach templates never emit a {{...}} placeholder, and each language has its own signature', () => {
  for (const tone of ['swiss_formal', 'fast_cash', 'approachable_trade'] as const) {
    for (const render of [
      generateFrTemplate({ ...BASE_PARAMS, tone }),
      generateDeTemplate({ ...BASE_PARAMS, tone }),
      generateItTemplate({ ...BASE_PARAMS, tone }),
    ]) {
      assert.ok(!render.subject.includes('{{'), `subject must not contain a placeholder: ${render.subject}`);
      assert.ok(!render.body.includes('{{'), 'body must not contain a placeholder');
      assert.ok(!render.html.includes('{{'), 'html must not contain a placeholder');
      // No awkward parenthetical canton anywhere (QA issue 53).
      assert.ok(!/\(\s*(ZH|VD|TI)\s*\)/.test(render.subject), `subject must not parenthesise the canton: ${render.subject}`);
      assert.ok(!/\(\s*(ZH|VD|TI)\s*\)/.test(render.body), `body must not parenthesise the canton: ${render.body}`);
    }
  }

  const fr = generateFrTemplate({ ...BASE_PARAMS, tone: 'swiss_formal' });
  assert.ok(fr.body.includes('Négoce de camions et machines de chantier'), 'FR signature must be French');
  assert.ok(!fr.body.includes('Lastwagen'), 'FR template must not use the German signature');
  assert.ok(fr.html.includes('Négoce de camions et machines de chantier'));

  const it = generateItTemplate({ ...BASE_PARAMS, tone: 'swiss_formal' });
  assert.ok(it.body.includes('Commercio di autocarri e macchine da cantiere'), 'IT signature must be Italian');
  assert.ok(!it.body.includes('Lastwagen'), 'IT template must not use the German signature');

  const de = generateDeTemplate({ ...BASE_PARAMS, tone: 'swiss_formal' });
  assert.ok(de.body.includes('Lastwagen & Baumaschine Händler'), 'DE signature stays German');
  assert.ok(de.body.includes('im Kanton ZH'), 'DE canton reads naturally ("im Kanton ZH")');
});

test('9. stripUnreplacedPlaceholders removes leftover tokens instead of letting them reach a seller', () => {
  assert.strictEqual(
    stripUnreplacedPlaceholders('Re: Reprise de matériel — {{company_name}}'),
    'Re: Reprise de matériel',
    'a trailing placeholder (and its dangling dash) is stripped'
  );
  assert.strictEqual(
    stripUnreplacedPlaceholders('Bonjour {{company_name}}, merci {{contractor_email}}'),
    'Bonjour , merci',
    'every placeholder is stripped'
  );
  assert.strictEqual(
    stripUnreplacedPlaceholders('Achat de machines — Müller Bau AG'),
    'Achat de machines — Müller Bau AG',
    'clean text passes through untouched'
  );
});

test('19. extractLatestReplyText stops at Gmail-wrapped quote headers', () => {
  // Real shape from the live leads: Gmail puts "wrote:" on its own line.
  const gmailEn = `Yes we do have a big machine in bern that costs 7000 euros\n\nOn Sat, 31 Oct 2026, 4:14\u202fpm Jamal - JIMY EXPORT, <info@jimyexport.ch>\nwrote:\n\n> Bonjour,\n> Nous sommes acheteurs de machines`;
  const strippedEn = extractLatestReplyText(gmailEn);
  assert.ok(strippedEn.includes('7000 euros'), 'the actual reply is kept');
  assert.ok(!strippedEn.includes('On Sat'), 'the wrapped quote header is cut');
  assert.ok(!strippedEn.includes('wrote:'), 'the header tail is cut');
  assert.ok(!strippedEn.includes('Nous sommes acheteurs'), 'quoted history is cut');

  const gmailIt = `Salut, pour le moment on rien à vendre, merci.\n\nIl dom 8 nov 2026, 22:56 Mokhtar - JIMY EXPORT <info@jimyexport.ch> ha\nscritto:\n\n> Bonjour à toute l'équipe,`;
  const strippedIt = extractLatestReplyText(gmailIt);
  assert.ok(strippedIt.includes('rien à vendre'), 'the actual reply is kept');
  assert.ok(!strippedIt.includes('Il dom'), 'the wrapped Italian quote header is cut');
  assert.ok(!strippedIt.includes('scritto:'), 'the header tail is cut');
  assert.ok(!strippedIt.includes("toute l'équipe"), 'quoted history is cut');
});

test('18. AI-unavailable summaries are personalized per seller, other summaries untouched', () => {
  assert.strictEqual(
    personalizeUnavailableSummary(AI_UNAVAILABLE_SUMMARY, 'Karim El Assali', 'PraderLosinger SA'),
    'Réponse de Karim El Assali (PraderLosinger SA) — analyse IA indisponible, vérification manuelle requise.'
  );
  assert.strictEqual(
    personalizeUnavailableSummary(AI_UNAVAILABLE_SUMMARY, undefined, 'PraderLosinger SA'),
    'Réponse de PraderLosinger SA — analyse IA indisponible, vérification manuelle requise.'
  );
  assert.strictEqual(
    personalizeUnavailableSummary('Une machine à forer est proposée pour 8027 euros à Berne.', 'Karim', 'PraderLosinger SA'),
    'Une machine à forer est proposée pour 8027 euros à Berne.',
    'a real Gemini summary must not be rewritten'
  );
});

test('20. matchCompanyFromSubject finds the company named in the reply subject', () => {
  const companies = [
    { id: 'c1', name: 'PraderLosinger SA', canton: 'VS' },
    { id: 'c2', name: 'Implenia Schweiz AG', canton: 'ZH' },
  ];
  assert.deepEqual(matchCompanyFromSubject('Re: Achat de machines de chantier — PraderLosinger SA', companies), {
    id: 'c1',
    name: 'PraderLosinger SA',
    canton: 'VS',
  });
  assert.strictEqual(
    matchCompanyFromSubject('Re: Reprise de matériel — {{company_name}}', companies),
    null,
    'an unreplaced placeholder names no company'
  );
  assert.strictEqual(matchCompanyFromSubject('Re: Machines', companies), null);
});

test('5. chat fallback only hints navigation on an explicit request to open a page', () => {
  assert.strictEqual(resolveChatFallbackNavigate('bonjour, test'), undefined);
  assert.strictEqual(resolveChatFallbackNavigate('Bonjour !'), undefined);
  assert.strictEqual(resolveChatFallbackNavigate('quelles sociétés sont en Valais ?'), undefined);
  assert.strictEqual(resolveChatFallbackNavigate('ouvre les dossiers'), 'leads');
  assert.strictEqual(resolveChatFallbackNavigate('montre-moi les courriels'), 'emails');
  assert.strictEqual(resolveChatFallbackNavigate('je veux voir mes offres'), 'leads');
  assert.strictEqual(resolveChatFallbackNavigate('aller à l\u2019accueil'), 'control');
  assert.strictEqual(resolveChatFallbackNavigate('ouvre les réglages'), 'persona');
  assert.strictEqual(resolveChatFallbackNavigate('affiche les sociétés du canton de Berne'), 'targets');
});

test('23. summarizeOfferPrices keeps original currency/amount next to the CHF total', () => {
  // Mirror of the live data: 8027 EUR (→ 7545 CHF) + 6000 CHF = 13 545 CHF.
  const summary = summarizeOfferPrices([
    {
      machinery_detected: [
        {
          type: 'Excavator',
          make_model: 'Unknown',
          asking_price: '8027 euros',
          asking_price_amount: 8027,
          asking_price_currency: 'EUR',
          asking_price_chf: 7545,
        },
      ],
    } as any,
    {
      machinery_detected: [
        {
          type: 'Tracked Machine',
          make_model: 'Trax',
          asking_price: '6000ch',
          asking_price_amount: 6000,
          asking_price_currency: 'CHF',
          asking_price_chf: 6000,
        },
      ],
    } as any,
    { machinery_detected: [] } as any,
  ]);
  assert.strictEqual(summary.total_chf, 13545);
  assert.strictEqual(summary.offers_count, 2);
  assert.strictEqual(summary.converted_count, 1);
  assert.strictEqual(summary.converted_total_chf, 7545);
  assert.deepEqual(summary.by_currency, [
    { currency: 'CHF', count: 1, total_amount: 6000 },
    { currency: 'EUR', count: 1, total_amount: 8027 },
  ]);
  assert.match(summary.note, /1 offre en EUR convertie/);
});

test('15. discovery stats reconcile: found = ready + missing + rejected + error; scanned = found + duplicates', async () => {
  const seed = async (status: string, i: number) =>
    supabaseDataService.addDiscoveryRecord({
      source: 'stub',
      source_id: `qa-fix-${status}-${i}`,
      company_name: `QA ${status} ${i}`,
      canton: 'VD',
      status: status as any,
      confidence: 0.9,
      reason: 'QA seed',
      query: 'qa',
    });
  for (let i = 0; i < 2; i++) await seed('ready', i);
  await seed('missing_email', 0);
  await seed('rejected', 0);
  await seed('duplicate', 0);
  await seed('error', 0);

  const stats = await supabaseDataService.getDiscoveryStats(new Date());
  assert.strictEqual(stats.ready_today, 2);
  assert.strictEqual(stats.missing_email_today, 1);
  assert.strictEqual(stats.rejected_today, 1);
  assert.strictEqual(stats.duplicates_today, 1);
  assert.strictEqual(stats.error_today, 1);
  assert.strictEqual(
    stats.found_today,
    stats.ready_today + stats.missing_email_today + stats.rejected_today + stats.error_today,
    'new finds must equal the sum of their buckets'
  );
  assert.strictEqual(
    stats.scanned_today,
    stats.found_today + stats.duplicates_today,
    'everything examined today must equal new finds + duplicates'
  );
});

test('20. a reply from a personal mailbox takes the canton of the company named in its subject', async () => {
  const company = await supabaseDataService.addCompany({
    name: 'PraderLosinger SA',
    email: 'geneve@praderlosinger.ch',
    canton: 'VS',
    language: 'fr',
    phone: '+41 27 000 00 00',
    domain: 'praderlosinger.ch',
    industry: 'civil_engineering',
    last_contacted_at: null,
  });

  // Mirrors the live lead e61c952d: Karim replying from his personal mailbox
  // to the PraderLosinger outreach, body mentioning Bern.
  const result = await inboundService.processInboundMessage({
    senderEmail: 'fifakarim52@gmail.com',
    companyName: 'Karim El Assali',
    rawSubject: 'Re: Achat de machines de chantier — PraderLosinger SA',
    rawBody: 'Yes we do have a big machine in bern that costs 7000 euros',
    messageId: '<msg-qa-canton-vs@fifakarim52.gmail>',
    source: 'manual_test',
  });
  assert.ok(result.lead, 'the reply must create a lead');
  assert.strictEqual(result.lead?.canton, 'VS', 'canton must come from the subject company record, not "in Bern"');
  assert.strictEqual(result.lead?.company_id, company.id, 'dossier must link to the subject company');
  assert.strictEqual(result.lead?.company_name, 'Karim El Assali', 'seller name itself is unchanged');
});

test('6/15/23. endpoints confirm in French and expose the reconciling fields', async () => {
  const server = app.listen(0);
  try {
    const address = server.address();
    assert.ok(address && typeof address === 'object', 'test server must listen');
    const base = `http://127.0.0.1:${address.port}`;
    const authHeaders = { 'x-admin-token': 'test-admin-token' };

    const discovery = await (
      await fetch(`${base}/api/discovery/status`, { headers: authHeaders })
    ).json();
    assert.strictEqual(discovery.ready_today, 2);
    assert.strictEqual(discovery.rejected_today, 1);
    assert.strictEqual(discovery.duplicates_today, 1);
    assert.strictEqual(discovery.error_today, 1);
    assert.strictEqual(discovery.scanned_today, 6);
    assert.strictEqual(
      discovery.found_today,
      discovery.ready_today + discovery.missing_email_today + discovery.rejected_today + discovery.error_today
    );

    const poll = await (
      await fetch(`${base}/api/imap/poll`, { method: 'POST', headers: authHeaders })
    ).json();
    assert.strictEqual(poll.success, true);
    assert.ok(
      typeof poll.message === 'string' && poll.message.length > 0,
      'Vérifier les réponses must return a French confirmation message'
    );

    const alert = await (
      await fetch(`${base}/api/test-telegram`, { method: 'POST', headers: authHeaders })
    ).json();
    assert.strictEqual(alert.success, true);
    assert.strictEqual(alert.message, 'Alerte test envoyée.');

    const testEmail = await (
      await fetch(`${base}/api/test-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body: JSON.stringify({ customSubject: 'Essai {{company_name}}' }),
      })
    ).json();
    assert.ok(!String(testEmail.previewSubject || '').includes('{{'), 'test email subject must not keep a placeholder');

    const summary = await (
      await fetch(`${base}/api/leads/offers-summary`, { headers: authHeaders })
    ).json();
    const leads = await supabaseDataService.getLeads();
    assert.deepEqual(summary, summarizeOfferPrices(leads), 'endpoint must match the summary helper on the same leads');
    assert.ok(typeof summary.note === 'string' && summary.note.length > 0);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
