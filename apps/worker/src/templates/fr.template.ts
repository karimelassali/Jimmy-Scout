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

export function generateFrTemplate(params: TemplateParams) {
  const hasPerson = isRealPersonName(params.recipientName, params.companyName);

  const salutation = hasPerson
    ? `Bonjour ${params.recipientName},`
    : `Bonjour,`;

  let hookItems: string[] = [];
  let hookHtmlList: string[] = [];

  if (params.hooks.cash_settlement) {
    hookItems.push('- Paiement par virement bancaire avant enlèvement');
    hookHtmlList.push('<li style="margin-bottom: 4px;">Paiement par virement bancaire avant enlèvement</li>');
  }
  if (params.hooks.transport_covered) {
    hookItems.push('- Transport et convoi exceptionnel pris en charge depuis votre dépôt');
    hookHtmlList.push('<li style="margin-bottom: 4px;">Transport et convoi exceptionnel pris en charge depuis votre dépôt</li>');
  }
  if (params.hooks.as_is) {
    hookItems.push("- Achat en l'état, sans garantie demandée");
    hookHtmlList.push("<li style=\"margin-bottom: 4px;\">Achat en l'état, sans garantie demandée</li>");
  }

  const focus = params.equipmentFocus || 'Pelles sur chenilles 15–30t, camions benne 4 essieux, chargeuses sur pneus, concasseurs';

  const subject = `Achat de machines de chantier — ${params.companyName}`;

  const body = `${salutation}

Nous sommes acheteurs de machines de chantier et camions en Suisse pour l'export et nos chantiers partenaires.

Nous recherchons actuellement :
${focus}

Avez-vous prévu de vendre ou de renouveler certaines machines de votre parc (${params.canton}) prochainement ?

Nos conditions :
${hookItems.join('\n')}

Si vous avez des machines disponibles, vous pouvez me répondre directement par e-mail ou m'appeler au ${params.senderPhone}.

Meilleures salutations,

${params.senderName}
JIMY EXPORT
Lastwagen & Baumaschine Händler
Tél : ${params.senderPhone}
${params.senderEmail}

--
Si vous ne souhaitez plus recevoir nos messages, répondez simplement STOP.`;

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #202124; line-height: 1.5;">
  <div style="max-width: 600px;">
    <p style="margin: 0 0 14px 0;">${salutation}</p>

    <p style="margin: 0 0 14px 0;">
      Nous sommes acheteurs de machines de chantier et camions en Suisse pour l'export et nos chantiers partenaires.
    </p>

    <p style="margin: 0 0 6px 0;">Nous recherchons actuellement :</p>
    <p style="margin: 0 0 14px 0; color: #202124;">
      ${focus}
    </p>

    <p style="margin: 0 0 14px 0;">
      Avez-vous prévu de vendre ou de renouveler certaines machines de votre parc (${params.canton}) prochainement ?
    </p>

    ${
      hookHtmlList.length > 0
        ? `<p style="margin: 0 0 6px 0;">Nos conditions :</p>
    <ul style="margin: 0 0 14px 0; padding-left: 20px; color: #202124;">
      ${hookHtmlList.join('\n      ')}
    </ul>`
        : ''
    }

    <p style="margin: 0 0 14px 0;">
      Si vous avez des machines disponibles, vous pouvez me répondre directement par e-mail ou m'appeler au <a href="tel:${params.senderPhone}" style="color: #1a73e8; text-decoration: none;">${params.senderPhone}</a>.
    </p>

    <p style="margin: 0 0 20px 0;">Meilleures salutations,</p>

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
      Si vous ne souhaitez plus recevoir nos messages, répondez simplement STOP.
    </p>
  </div>
</body>
</html>`;

  return { subject, body, html };
}
