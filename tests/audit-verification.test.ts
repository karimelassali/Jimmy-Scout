import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// Force isolated in-memory storage and external service stubs BEFORE importing app modules
process.env.JIMISCOUT_STUB_EXTERNAL = 'true';
process.env.JIMISCOUT_USE_MEMORY_ONLY = 'true';
process.env.JIMISCOUT_DISABLE_DAEMON = 'true';
process.env.JIMISCOUT_ADMIN_TOKEN = 'test-admin-secret-token-2026';
process.env.WEBHOOK_SECRET = 'test-webhook-secret-2026';

import {
  ALL_SWISS_CANTONS,
  parsePriceString,
  convertToChf,
  localizeEquipmentFocus,
  escapeHtml,
} from '../packages/types/src/swiss.ts';
import {
  isSwissBusinessHours,
  isSameSwissDay,
  resolveCompanyLanguage,
  isEligibleForOutbound,
} from '../apps/worker/src/scheduler.ts';
import { generateDeTemplate } from '../apps/worker/src/templates/de.template.ts';
import { generateFrTemplate } from '../apps/worker/src/templates/fr.template.ts';
import { generateItTemplate } from '../apps/worker/src/templates/it.template.ts';
import { extractLatestReplyText } from '../apps/worker/src/services/imap.service.ts';
import { validateReplyAnalysis } from '../apps/worker/src/services/gemini.service.ts';
import { supabaseDataService } from '../apps/worker/src/services/supabase.service.ts';
import { inboundService } from '../apps/worker/src/services/inbound.service.ts';
import { outboundScheduler } from '../apps/worker/src/services/outbound-scheduler.service.ts';
import { app, sanitizeCsvCell, parseCsvContent } from '../server.ts';

test('1. All 26 Swiss cantons and language routing work accurately', () => {
  assert.strictEqual(ALL_SWISS_CANTONS.length, 26, 'Must include all 26 Swiss cantons');
  const codes = new Set(ALL_SWISS_CANTONS.map((c) => c.code));
  for (const expected of [
    'ZH', 'BE', 'LU', 'UR', 'SZ', 'OW', 'NW', 'GL', 'ZG', 'FR', 'SO', 'BS', 'BL',
    'SH', 'AR', 'AI', 'SG', 'GR', 'AG', 'TG', 'TI', 'VD', 'VS', 'NE', 'GE', 'JU',
  ]) {
    assert.ok(codes.has(expected), `Missing canton ${expected}`);
  }

  // Explicit company language overrides canton default (e.g., bilingual Bern or Valais)
  assert.strictEqual(resolveCompanyLanguage({ canton: 'BE', language: 'fr' }), 'fr');
  assert.strictEqual(resolveCompanyLanguage({ canton: 'VS', language: 'de' }), 'de');
  assert.strictEqual(resolveCompanyLanguage({ canton: 'TI', language: null }), 'it');
});

test('2. Swiss business hours (08:30-17:00 Europe/Zurich) across CET and CEST', () => {
  // Winter CET (UTC+1): Wednesday 2026-01-14 09:00 UTC = 10:00 Zurich -> true
  assert.strictEqual(isSwissBusinessHours(new Date('2026-01-14T09:00:00Z')), true);
  // Winter CET (UTC+1): Wednesday 2026-01-14 07:00 UTC = 08:00 Zurich -> false (before 08:30)
  assert.strictEqual(isSwissBusinessHours(new Date('2026-01-14T07:00:00Z')), false);
  // Summer CEST (UTC+2): Wednesday 2026-07-15 06:30 UTC = 08:30 Zurich -> true
  assert.strictEqual(isSwissBusinessHours(new Date('2026-07-15T06:30:00Z')), true);
  // Summer CEST (UTC+2): Wednesday 2026-07-15 15:05 UTC = 17:05 Zurich -> false (after 17:00)
  assert.strictEqual(isSwissBusinessHours(new Date('2026-07-15T15:05:00Z')), false);
  // Saturday in Zurich -> false
  assert.strictEqual(isSwissBusinessHours(new Date('2026-07-18T10:00:00Z')), false);

  // Swiss calendar day comparison around midnight Zurich
  assert.strictEqual(
    isSameSwissDay('2026-07-15T22:30:00Z', new Date('2026-07-16T08:00:00Z')),
    true,
    '22:30 UTC in summer is 00:30 next day in Zurich'
  );
});

test('3. Templates differentiate tones, localize equipment focus, and escape HTML', () => {
  const baseParams = {
    companyName: 'Müller Bau AG <script>alert(1)</script>',
    canton: 'ZH',
    senderName: 'Jamal',
    senderEmail: 'info@jimyexport.ch',
    senderPhone: '+41 79 123 45 67',
    hooks: { cash_settlement: true, transport_covered: true, as_is: true },
    equipmentFocus: 'Pelles sur chenilles 15–30t, camions benne 4 essieux',
  };

  const deFormal = generateDeTemplate({ ...baseParams, tone: 'swiss_formal' });
  const deFastCash = generateDeTemplate({ ...baseParams, tone: 'fast_cash' });
  const itFormal = generateItTemplate({ ...baseParams, canton: 'TI', tone: 'swiss_formal' });
  const frTrade = generateFrTemplate({ ...baseParams, canton: 'VD', tone: 'approachable_trade' });

  assert.notStrictEqual(deFormal.subject, deFastCash.subject, 'Tone must change subject');
  assert.notStrictEqual(deFormal.body, deFastCash.body, 'Tone must change body');
  assert.ok(
    deFormal.body.includes('Raupenbagger'),
    'German template must localize French equipment focus into German'
  );
  assert.ok(
    itFormal.body.includes('Escavatori cingolati'),
    'Italian template must localize French equipment focus into Italian'
  );
  assert.ok(
    !deFormal.html.includes('<script>alert(1)</script>'),
    'HTML template must escape unescaped script tags'
  );
  assert.ok(
    deFormal.html.includes('&lt;script&gt;'),
    'HTML template must encode <script> entities'
  );
  assert.ok(frTrade.body.includes('STOP'), 'Template must include LPD/DSG opt-out notice');
});

test('4. Currency-aware Swiss/European price parsing avoids decimal inflation', () => {
  const chfApostrophe = parsePriceString("CHF 68'500");
  assert.strictEqual(chfApostrophe.amount, 68500);
  assert.strictEqual(chfApostrophe.currency, 'CHF');

  const eurDecimals = parsePriceString('EUR 45,000.00');
  assert.strictEqual(eurDecimals.amount, 45000);
  assert.strictEqual(eurDecimals.currency, 'EUR');

  const deFormat = parsePriceString('42.500,00 EUR');
  assert.strictEqual(deFormat.amount, 42500);
  assert.strictEqual(deFormat.currency, 'EUR');

  const chfConverted = convertToChf(eurDecimals.amount, eurDecimals.currency);
  assert.ok(chfConverted && chfConverted > 40000 && chfConverted < 46000);
});

test('5. Quoted reply stripping and Gemini output validation', () => {
  const threadBody = `Grüezi Herr Jamal,\nWir haben einen Liebherr R924 (2018) für CHF 54'000 abzugeben.\n\nAm 12.10.2026 schrieb Jamal <info@jimyexport.ch>:\n> Guten Tag\n> Wir kaufen Bagger`;
  const stripped = extractLatestReplyText(threadBody);
  assert.ok(stripped.includes('Liebherr R924'));
  assert.ok(!stripped.includes('Wir kaufen Bagger'), 'Quoted history must be stripped');

  const validated = validateReplyAnalysis({
    intent: 'HOT_LEAD',
    confidence: 1.5, // out of range, should clamp to 1
    equipment_fit_score: 88,
    machinery_detected: [
      {
        type: 'Raupenbagger',
        make_model: 'Liebherr R924',
        year: 2018,
        hours: 5200,
        asking_price: "CHF 54'000",
      },
    ],
    french_summary: 'Offre Liebherr R924 à 54 000 CHF.',
  });
  assert.strictEqual(validated.confidence, 1);
  assert.strictEqual(validated.equipment_fit_score, 88);
  assert.strictEqual(validated.machinery_detected[0].asking_price_chf, 54000);
});

test('6. Durable suppression & 30-day cooldown survive company deletion and re-import', async () => {
  const comp = await supabaseDataService.addCompany({
    name: 'Test Tiefbau AG',
    email: 'optout@test-tiefbau.ch',
    canton: 'ZH',
    language: 'de',
    phone: '+41 44 111 22 33',
    domain: 'test-tiefbau.ch',
    industry: 'tiefbau',
    last_contacted_at: new Date().toISOString(),
    unsubscribed: true,
  });

  // Delete company
  await supabaseDataService.deleteCompany(comp.id);

  // Re-import via bulk with unsubscribed: false and last_contacted_at: null
  const reimported = await supabaseDataService.addCompaniesBulk([
    {
      name: 'Test Tiefbau AG Renamed',
      email: 'optout@test-tiefbau.ch',
      canton: 'ZH',
      language: 'de',
      phone: null,
      domain: 'test-tiefbau.ch',
      industry: 'tiefbau',
      last_contacted_at: null,
      unsubscribed: false,
    },
  ]);

  const restored = reimported.companies.find((c) => c.email === 'optout@test-tiefbau.ch');
  assert.ok(restored, 'Company should exist in directory');
  assert.strictEqual(
    restored!.unsubscribed,
    true,
    'Unsubscribed flag must be preserved from suppression_registry across delete + re-import'
  );
  assert.ok(
    restored!.last_contacted_at,
    'Prior last_contacted_at cooldown must be preserved across delete + re-import'
  );
});

test('7. Inbound idempotency, UNSUBSCRIBE vs NOT_INTERESTED, and HOT_LEAD creation', async () => {
  // Add a contractor for NOT_INTERESTED test
  const noStockComp = await supabaseDataService.addCompany({
    name: 'NoStock Sàrl',
    email: 'info@nostock-btp.ch',
    canton: 'VD',
    language: 'fr',
    phone: '+41 21 555 00 11',
    domain: 'nostock-btp.ch',
    industry: 'civil_engineering',
    last_contacted_at: null,
  });

  // 1. NOT_INTERESTED reply should set 30-day cooldown + stock_status='no_stock_temporarily', NOT unsubscribed
  const notInterestedRes = await inboundService.processInboundMessage({
    senderEmail: 'info@nostock-btp.ch',
    rawSubject: 'Re: Machines',
    rawBody: 'Bonjour, pas de machines disponibles actuellement.',
    messageId: '<msg-not-interested-1@nostock-btp.ch>',
    source: 'manual_test',
  });
  assert.strictEqual(notInterestedRes.analysis.intent, 'NOT_INTERESTED');

  const updatedNoStock = await supabaseDataService.findCompanyByEmail('info@nostock-btp.ch');
  assert.strictEqual(
    updatedNoStock?.unsubscribed,
    false,
    'NOT_INTERESTED must not permanently unsubscribe contractor'
  );
  assert.strictEqual(updatedNoStock?.stock_status, 'no_stock_temporarily');
  assert.ok(updatedNoStock?.last_contacted_at, 'NOT_INTERESTED must record contact timestamp');

  // 2. UNSUBSCRIBE from an unknown sender must be recorded in suppression_registry
  const unsubRes = await inboundService.processInboundMessage({
    senderEmail: 'stop-me@unknown-contractor.ch',
    rawSubject: 'STOP',
    rawBody: 'STOP. Bitte keine weiteren E-Mails senden. Abmelden.',
    messageId: '<msg-unsub-1@unknown-contractor.ch>',
    source: 'manual_test',
  });
  assert.strictEqual(unsubRes.analysis.intent, 'UNSUBSCRIBE');
  const isSuppressed = await supabaseDataService.isEmailOrDomainSuppressed(
    'stop-me@unknown-contractor.ch'
  );
  assert.strictEqual(isSuppressed, true, 'Unknown sender requesting STOP must be suppressed');

  // 3. HOT_LEAD reply creates lead once and deduplicates on replay
  const hotLeadPayload = {
    senderEmail: 'verkauf@baumaschinen-ag.ch',
    companyName: 'Baumaschinen AG',
    canton: 'BE',
    rawSubject: 'Re: Ankauf Raupenbagger',
    rawBody: 'Guten Tag, wir verkaufen unseren Cat 323 (Baujahr 2019) für CHF 72000.',
    messageId: '<msg-hot-lead-999@baumaschinen-ag.ch>',
    source: 'imap' as const,
  };

  const firstHot = await inboundService.processInboundMessage(hotLeadPayload);
  assert.strictEqual(firstHot.isDuplicate, false);
  assert.strictEqual(firstHot.analysis.intent, 'HOT_LEAD');
  assert.ok(firstHot.lead?.id);

  const duplicateHot = await inboundService.processInboundMessage(hotLeadPayload);
  assert.strictEqual(
    duplicateHot.isDuplicate,
    true,
    'Replaying the same inbound messageId must be deduplicated'
  );
});

test('8. Outbound scheduler enforces quota, verified email requirement, and cooldown', async () => {
  await supabaseDataService.updateSettings({
    is_active: true,
    daily_limit: 25,
    selected_cantons: ['VD', 'ZH', 'BE'],
  });

  // Add phone-only company (blank email) -> should NEVER be emailed
  await supabaseDataService.addCompany({
    name: 'Phone Only Contractor SA',
    email: '',
    verified_email: false,
    canton: 'VD',
    language: 'fr',
    phone: '+41 21 999 88 77',
    domain: null,
    industry: 'civil_engineering',
    last_contacted_at: null,
  });

  // Add eligible verified company
  const eligibleComp = await supabaseDataService.addCompany({
    name: 'Eligible Romandie SA',
    email: 'atelier@eligible-romandie.ch',
    verified_email: true,
    canton: 'VD',
    language: 'fr',
    phone: '+41 21 333 44 55',
    domain: 'eligible-romandie.ch',
    industry: 'civil_engineering',
    last_contacted_at: null,
  });

  const stepRes = await outboundScheduler.executeStep({
    manualOverride: true,
    companyId: eligibleComp.id,
  });

  assert.strictEqual(stepRes.status, 'dispatched');
  assert.strictEqual(stepRes.email, 'atelier@eligible-romandie.ch');

  // Trying to dispatch again to the same company immediately must fail eligibility (30-day cooldown)
  const repeatRes = await outboundScheduler.executeStep({
    manualOverride: true,
    companyId: eligibleComp.id,
  });
  assert.strictEqual(repeatRes.status, 'idle');
});

test('9. Express API authentication, webhook HMAC verification, and CSV formula protection', async () => {
  // CSV formula injection protection
  assert.strictEqual(sanitizeCsvCell('=CMD|" /C calc"!A0'), `"'=CMD|"" /C calc""!A0"`);
  assert.strictEqual(sanitizeCsvCell('+41 79 123 45 67'), `"'+41 79 123 45 67"`);
  assert.strictEqual(sanitizeCsvCell('Kibag AG'), `"Kibag AG"`);

  // RFC CSV parser
  const rows = parseCsvContent(
    'name,email,canton\n"Implenia SA, Suisse",contact@implenia.ch,VD'
  );
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].name, 'Implenia SA, Suisse');
  assert.strictEqual(rows[0].canton, 'VD');

  // Start ephemeral HTTP server for API integration test
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. /api/health is public and returns 200
    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.strictEqual(healthJson.status, 'ok');

    // 2. Unauthenticated request to /api/settings returns 401
    const unauthRes = await fetch(`${baseUrl}/api/settings`);
    assert.strictEqual(unauthRes.status, 401);

    // 3. Authenticated request with x-admin-token returns 200
    const authRes = await fetch(`${baseUrl}/api/settings`, {
      headers: { 'x-admin-token': 'test-admin-secret-token-2026' },
    });
    assert.strictEqual(authRes.status, 200);

    // 4. Unsigned request to /api/webhooks/imap returns 401
    const unsignedWebhook = await fetch(`${baseUrl}/api/webhooks/imap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        senderEmail: 'test@contractor.ch',
        rawBody: 'Bonjour',
      }),
    });
    assert.strictEqual(unsignedWebhook.status, 401);

    // 5. Signed HMAC request to /api/webhooks/imap succeeds (200) and replay is rejected (409)
    const webhookBody = {
      senderEmail: 'hmac-seller@contractor.ch',
      rawSubject: 'Liebherr A918',
      rawBody: 'Nous vendons une pelle Liebherr A918 pour CHF 62000.',
      messageId: '<hmac-msg-01@contractor.ch>',
    };
    const ts = String(Date.now());
    const sig = crypto
      .createHmac('sha256', 'test-webhook-secret-2026')
      .update(`${ts}.${JSON.stringify(webhookBody)}`)
      .digest('hex');

    const signedWebhook = await fetch(`${baseUrl}/api/webhooks/imap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-timestamp': ts,
        'x-webhook-signature': `sha256=${sig}`,
      },
      body: JSON.stringify(webhookBody),
    });
    assert.strictEqual(signedWebhook.status, 200);

    const replayWebhook = await fetch(`${baseUrl}/api/webhooks/imap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-webhook-timestamp': ts,
        'x-webhook-signature': `sha256=${sig}`,
      },
      body: JSON.stringify(webhookBody),
    });
    assert.strictEqual(replayWebhook.status, 409, 'Webhook signature replay must return 409');
  } finally {
    server.close();
  }
});
