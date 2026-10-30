import { TemplateParams } from './de.template.ts';

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

export function generateItTemplate(params: TemplateParams) {
  const hasPerson = isRealPersonName(params.recipientName, params.companyName);

  const salutation = hasPerson
    ? `Buongiorno ${params.recipientName},`
    : `Buongiorno,`;

  let hookItems: string[] = [];
  let hookHtmlList: string[] = [];

  if (params.hooks.cash_settlement) {
    hookItems.push('- Pagamento immediato tramite bonifico bancario prima del ritiro');
    hookHtmlList.push('<li style="margin-bottom: 4px;">Pagamento immediato tramite bonifico bancario prima del ritiro</li>');
  }
  if (params.hooks.transport_covered) {
    hookItems.push('- Trasporto e logistica interamente a nostro carico dal vostro piazzale');
    hookHtmlList.push('<li style="margin-bottom: 4px;">Trasporto e logistica interamente a nostro carico dal vostro piazzale</li>');
  }
  if (params.hooks.as_is) {
    hookItems.push('- Acquisto nello stato in cui si trova (visto e piaciuto), senza garanzia');
    hookHtmlList.push('<li style="margin-bottom: 4px;">Acquisto nello stato in cui si trova (visto e piaciuto), senza garanzia</li>');
  }

  const focus = params.equipmentFocus || 'Escavatori cingolati 15–30t, camion 4 assi ribaltabili, pale gommate, frantoi';

  const subject = `Acquisto macchinari da cantiere — ${params.companyName}`;

  const body = `${salutation}

acquistiamo regolarmente macchine da cantiere e autocarri usati in Svizzera per l'esportazione e per i nostri cantieri partner.

Attualmente cerchiamo:
${focus}

Avete in programma di vendere o sostituire alcuni mezzi del vostro parco macchine (${params.canton}) prossimamente?

Le nostre condizioni:
${hookItems.join('\n')}

Se avete macchinari disponibili, potete rispondermi direttamente via e-mail o chiamarmi al ${params.senderPhone}.

Cordiali saluti,

${params.senderName}
JIMY EXPORT
Lastwagen & Baumaschine Händler
Tel: ${params.senderPhone}
${params.senderEmail}

--
Se non desidera ricevere altri messaggi, risponda semplicemente STOP.`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #202124; line-height: 1.5;">
  <div style="max-width: 600px;">
    <p style="margin: 0 0 14px 0;">${salutation}</p>

    <p style="margin: 0 0 14px 0;">
      acquistiamo regolarmente macchine da cantiere e autocarri usati in Svizzera per l'esportazione e per i nostri cantieri partner.
    </p>

    <p style="margin: 0 0 6px 0;">Attualmente cerchiamo:</p>
    <p style="margin: 0 0 14px 0; color: #202124;">
      ${focus}
    </p>

    <p style="margin: 0 0 14px 0;">
      Avete in programma di vendere o sostituire alcuni mezzi del vostro parco macchine (${params.canton}) prossimamente?
    </p>

    ${
      hookHtmlList.length > 0
        ? `<p style="margin: 0 0 6px 0;">Le nostre condizioni:</p>
    <ul style="margin: 0 0 14px 0; padding-left: 20px; color: #202124;">
      ${hookHtmlList.join('\n      ')}
    </ul>`
        : ''
    }

    <p style="margin: 0 0 14px 0;">
      Se avete macchinari disponibili, potete rispondermi direttamente via e-mail o chiamarmi al <a href="tel:${params.senderPhone}" style="color: #1a73e8; text-decoration: none;">${params.senderPhone}</a>.
    </p>

    <p style="margin: 0 0 20px 0;">Cordiali saluti,</p>

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
      Se non desidera ricevere altri messaggi, risponda semplicemente STOP.
    </p>
  </div>
</body>
</html>`;

  return { subject, body, html };
}
