import { PersonaHooks, ToneType } from '@/packages/types/src/database.ts';
import { escapeHtml, localizeEquipmentFocus } from '@/packages/types/src/swiss.ts';

export interface TemplateParams {
  companyName: string;
  recipientName?: string;
  canton: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string;
  tone: ToneType;
  hooks: PersonaHooks;
  equipmentFocus?: string;
}

function isRealPersonName(name?: string, companyName?: string): boolean {
  if (!name || !name.trim()) return false;
  const n = name.trim();
  if (companyName && n.toLowerCase() === companyName.trim().toLowerCase()) return false;
  if (/\b(sa|sarl|sàrl|ag|gmbh|cie|corp|ltd|holding|group|groupe|spa|srl)\b/i.test(n)) {
    return false;
  }
  if (/direction|parc|material|atelier|verwaltung|direktion|fleet|geschäftsleitung/i.test(n)) {
    return false;
  }
  return true;
}

export function generateDeTemplate(params: TemplateParams) {
  const hasPerson = isRealPersonName(params.recipientName, params.companyName);
  const tone = params.tone || 'swiss_formal';

  const salutation = hasPerson
    ? tone === 'approachable_trade'
      ? `Grüezi ${params.recipientName},`
      : `Guten Tag ${params.recipientName},`
    : tone === 'approachable_trade'
    ? `Grüezi miteinander,`
    : `Guten Tag,`;

  const hookItems: string[] = [];
  const hookHtmlList: string[] = [];

  if (params.hooks.cash_settlement) {
    const text =
      tone === 'fast_cash'
        ? 'Sofortige Direktüberweisung / Barzahlung noch vor Verladung'
        : 'Sofortige Banküberweisung oder Barzahlung vor Abholung';
    hookItems.push(`- ${text}`);
    hookHtmlList.push(`<li style="margin-bottom: 4px;">${escapeHtml(text)}</li>`);
  }
  if (params.hooks.transport_covered) {
    const text = 'Komplette Organisation und Übernahme des Transports ab Ihrem Werkhof';
    hookItems.push(`- ${text}`);
    hookHtmlList.push(`<li style="margin-bottom: 4px;">${escapeHtml(text)}</li>`);
  }
  if (params.hooks.as_is) {
    const text = 'Kauf im Ist-Zustand ab Platz, ohne Garantieansprüche';
    hookItems.push(`- ${text}`);
    hookHtmlList.push(`<li style="margin-bottom: 4px;">${escapeHtml(text)}</li>`);
  }

  const focus = localizeEquipmentFocus(params.equipmentFocus, 'de');

  const subject =
    tone === 'fast_cash'
      ? `Sofortankauf Baumaschinen & LKW — ${params.companyName}`
      : tone === 'approachable_trade'
      ? `Direktankauf ab Werkhof im Kanton ${params.canton} — ${params.companyName}`
      : `Ankauf Baumaschinen & Nutzfahrzeuge — ${params.companyName}`;

  const introParagraph =
    tone === 'fast_cash'
      ? `wir suchen per sofort gebrauchte Baumaschinen und Lastwagen zur direkten Übernahme gegen schnelle Abwicklung.`
      : tone === 'approachable_trade'
      ? `als direkter Einkäufer für Baustellen- und Exportmaschinen fragen wir unkompliziert bei Schweizer Betrieben im Kanton ${params.canton} an.`
      : `wir kaufen laufend gebrauchte Baumaschinen und Lastwagen in der Schweiz für den Export und unsere Partnerbetriebe an.`;

  const questionParagraph =
    tone === 'fast_cash'
      ? `Haben Sie aktuell eine Maschine auf Ihrem Platz im Kanton ${params.canton}, die Sie kurzfristig und ohne Aufwand verkaufen möchten?`
      : `Planen Sie in nächster Zeit in Ihrem Betrieb im Kanton ${params.canton} den Verkauf oder Ersatz einzelner Maschinen?`;

  const body = `${salutation}

${introParagraph}

Aktuell suchen wir insbesondere:
${focus}

${questionParagraph}

Unsere Konditionen:
${hookItems.join('\n')}

Bei Interesse oder verfügbaren Maschinen erreichen Sie mich direkt per E-Mail oder telefonisch unter ${params.senderPhone}.

Freundliche Grüsse

${params.senderName}
JIMY EXPORT
Lastwagen & Baumaschine Händler
Tel: ${params.senderPhone}
${params.senderEmail}

--
Falls Sie keine weiteren Nachrichten wünschen, antworten Sie einfach mit STOP.`;

  const safeCompany = escapeHtml(params.companyName);
  const safeSalutation = escapeHtml(salutation);
  const safeIntro = escapeHtml(introParagraph);
  const safeFocus = escapeHtml(focus);
  const safeQuestion = escapeHtml(questionParagraph);
  const safePhone = escapeHtml(params.senderPhone);
  const safeName = escapeHtml(params.senderName);
  const safeEmail = escapeHtml(params.senderEmail);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="x-company" content="${safeCompany}">
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #202124; line-height: 1.5;">
  <div style="max-width: 600px;">
    <p style="margin: 0 0 14px 0;">${safeSalutation}</p>

    <p style="margin: 0 0 14px 0;">
      ${safeIntro}
    </p>

    <p style="margin: 0 0 6px 0;">Aktuell suchen wir insbesondere:</p>
    <p style="margin: 0 0 14px 0; color: #202124;">
      ${safeFocus}
    </p>

    <p style="margin: 0 0 14px 0;">
      ${safeQuestion}
    </p>

    ${
      hookHtmlList.length > 0
        ? `<p style="margin: 0 0 6px 0;">Unsere Konditionen:</p>
    <ul style="margin: 0 0 14px 0; padding-left: 20px; color: #202124;">
      ${hookHtmlList.join('\n      ')}
    </ul>`
        : ''
    }

    <p style="margin: 0 0 14px 0;">
      Bei Interesse oder verfügbaren Maschinen erreichen Sie mich direkt per E-Mail oder telefonisch unter <a href="tel:${safePhone}" style="color: #1a73e8; text-decoration: none;">${safePhone}</a>.
    </p>

    <p style="margin: 0 0 20px 0;">Freundliche Grüsse</p>

    <!-- Native Gmail Signature -->
    <table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #202124; line-height: 1.4;">
      <tr>
        <td style="vertical-align: top; padding-right: 12px;">
          <img src="cid:jimy_export_profile_pic" alt="JIMY EXPORT" width="48" height="48" style="width: 48px; height: 48px; border-radius: 50%; display: block; object-fit: cover;" />
        </td>
        <td style="vertical-align: top; border-left: 1px solid #dadce0; padding-left: 12px;">
          <div style="font-weight: bold; color: #202124; font-size: 13px;">${safeName}</div>
          <div style="color: #5f6368; font-size: 12px;">JIMY EXPORT · Lastwagen &amp; Baumaschine Händler</div>
          <div style="color: #5f6368; font-size: 12px; margin-top: 2px;">
            <a href="tel:${safePhone}" style="color: #1a73e8; text-decoration: none;">${safePhone}</a> · <a href="mailto:${safeEmail}" style="color: #1a73e8; text-decoration: none;">${safeEmail}</a>
          </div>
        </td>
      </tr>
    </table>

    <p style="margin: 24px 0 0 0; font-size: 11px; color: #70757a;">
      Falls Sie keine weiteren Nachrichten wünschen, antworten Sie einfach mit STOP.
    </p>
  </div>
</body>
</html>`;

  return { subject, body, html };
}
