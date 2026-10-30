import { PersonaHooks, ToneType } from '@/packages/types/src/database.ts';

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

  const salutation = hasPerson
    ? `Guten Tag ${params.recipientName},`
    : `Guten Tag,`;

  let hookItems: string[] = [];
  let hookHtmlList: string[] = [];

  if (params.hooks.cash_settlement) {
    hookItems.push('- Sofortige Banküberweisung oder Barzahlung vor Abholung');
    hookHtmlList.push('<li style="margin-bottom: 4px;">Sofortige Banküberweisung oder Barzahlung vor Abholung</li>');
  }
  if (params.hooks.transport_covered) {
    hookItems.push('- Komplette Organisation und Übernahme des Transports ab Ihrem Werkhof');
    hookHtmlList.push('<li style="margin-bottom: 4px;">Komplette Organisation und Übernahme des Transports ab Ihrem Werkhof</li>');
  }
  if (params.hooks.as_is) {
    hookItems.push('- Kauf im Ist-Zustand ab Platz, ohne Garantieansprüche');
    hookHtmlList.push('<li style="margin-bottom: 4px;">Kauf im Ist-Zustand ab Platz, ohne Garantieansprüche</li>');
  }

  const focus = params.equipmentFocus || 'Raupenbagger 15–30t, 4-Achs Kipper, Radlader, Mobilbrecher';

  const subject = `Ankauf Baumaschinen & Nutzfahrzeuge — ${params.companyName}`;

  const body = `${salutation}

wir kaufen laufend gebrauchte Baumaschinen und Lastwagen in der Schweiz für den Export und unsere Partnerbetriebe an.

Aktuell suchen wir insbesondere:
${focus}

Planen Sie in nächster Zeit in Ihrem Betrieb (${params.canton}) den Verkauf oder Ersatz einzelner Maschinen?

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

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #202124; line-height: 1.5;">
  <div style="max-width: 600px;">
    <p style="margin: 0 0 14px 0;">${salutation}</p>

    <p style="margin: 0 0 14px 0;">
      wir kaufen laufend gebrauchte Baumaschinen und Lastwagen in der Schweiz für den Export und unsere Partnerbetriebe an.
    </p>

    <p style="margin: 0 0 6px 0;">Aktuell suchen wir insbesondere:</p>
    <p style="margin: 0 0 14px 0; color: #202124;">
      ${focus}
    </p>

    <p style="margin: 0 0 14px 0;">
      Planen Sie in nächster Zeit in Ihrem Betrieb (${params.canton}) den Verkauf oder Ersatz einzelner Maschinen?
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
      Bei Interesse oder verfügbaren Maschinen erreichen Sie mich direkt per E-Mail oder telefonisch unter <a href="tel:${params.senderPhone}" style="color: #1a73e8; text-decoration: none;">${params.senderPhone}</a>.
    </p>

    <p style="margin: 0 0 20px 0;">Freundliche Grüsse</p>

    <!-- Native Gmail Signature -->
    <table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #202124; line-height: 1.4;">
      <tr>
        <td style="vertical-align: top; padding-right: 12px;">
          <img src="cid:jimy_export_profile_pic" alt="JIMY EXPORT" width="48" height="48" style="width: 48px; height: 48px; border-radius: 50%; display: block; object-fit: cover;" />
        </td>
        <td style="vertical-align: top; border-left: 1px solid #dadce0; padding-left: 12px;">
          <div style="font-weight: bold; color: #202124; font-size: 13px;">${params.senderName}</div>
          <div style="color: #5f6368; font-size: 12px;">JIMY EXPORT · Lastwagen &amp; Baumaschine Händler</div>
          <div style="color: #5f6368; font-size: 12px; margin-top: 2px;">
            <a href="tel:${params.senderPhone}" style="color: #1a73e8; text-decoration: none;">${params.senderPhone}</a> · <a href="mailto:${params.senderEmail}" style="color: #1a73e8; text-decoration: none;">${params.senderEmail}</a>
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
