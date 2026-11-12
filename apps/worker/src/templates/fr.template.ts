import { TemplateParams } from './de.template.ts';
import { escapeHtml, localizeEquipmentFocus } from '@/packages/types/src/swiss.ts';

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
  const tone = params.tone || 'swiss_formal';

  const salutation = hasPerson
    ? `Bonjour ${params.recipientName},`
    : tone === 'approachable_trade'
    ? `Bonjour à toute l'équipe,`
    : `Bonjour,`;

  const hookItems: string[] = [];
  const hookHtmlList: string[] = [];

  if (params.hooks.cash_settlement) {
    const text =
      tone === 'fast_cash'
        ? 'Paiement comptant immédiat par virement bancaire avant chargement'
        : 'Paiement par virement bancaire avant enlèvement';
    hookItems.push(`- ${text}`);
    hookHtmlList.push(`<li style="margin-bottom: 4px;">${escapeHtml(text)}</li>`);
  }
  if (params.hooks.transport_covered) {
    const text = 'Transport et convoi exceptionnel pris en charge depuis votre dépôt';
    hookItems.push(`- ${text}`);
    hookHtmlList.push(`<li style="margin-bottom: 4px;">${escapeHtml(text)}</li>`);
  }
  if (params.hooks.as_is) {
    const text = "Achat en l'état, sans garantie demandée";
    hookItems.push(`- ${text}`);
    hookHtmlList.push(`<li style="margin-bottom: 4px;">${escapeHtml(text)}</li>`);
  }

  const focus = localizeEquipmentFocus(params.equipmentFocus, 'fr');

  const subject =
    tone === 'fast_cash'
      ? `Rachat immédiat de machines BTP — ${params.companyName}`
      : tone === 'approachable_trade'
      ? `Achat direct machines de chantier — ${params.companyName}`
      : `Achat de machines de chantier — ${params.companyName}`;

  const introParagraph =
    tone === 'fast_cash'
      ? `Nous rachetons immédiatement des machines de chantier et camions d'occasion en Suisse avec paiement rapide avant enlèvement.`
      : tone === 'approachable_trade'
      ? `En tant qu'acheteur direct sur le terrain en Suisse, nous reprenons régulièrement des machines et camions auprès des entreprises de génie civil.`
      : `Nous sommes acheteurs de machines de chantier et camions en Suisse pour l'export et nos chantiers partenaires.`;

  const questionParagraph =
    tone === 'fast_cash'
      ? `Avez-vous actuellement sur votre dépôt un engin ou camion disponible pour une vente rapide ?`
      : `Avez-vous prévu de vendre ou de renouveler certaines machines de votre parc prochainement ?`;

  const body = `${salutation}

${introParagraph}

Nous recherchons actuellement :
${focus}

${questionParagraph}

Nos conditions :
${hookItems.join('\n')}

Si vous avez des machines disponibles, vous pouvez me répondre directement par e-mail ou m'appeler au ${params.senderPhone}.

Meilleures salutations,

${params.senderName}
JIMY EXPORT
Négoce de camions et machines de chantier
Tél : ${params.senderPhone}
${params.senderEmail}

--
Si vous ne souhaitez plus recevoir nos messages, répondez simplement STOP.`;

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
</head>
<body style="margin: 0; padding: 0; background-color: #ffffff; font-family: Arial, Helvetica, sans-serif; font-size: 14px; color: #202124; line-height: 1.5;">
  <div style="max-width: 600px;">
    <p style="margin: 0 0 14px 0;">${safeSalutation}</p>

    <p style="margin: 0 0 14px 0;">
      ${safeIntro}
    </p>

    <p style="margin: 0 0 6px 0;">Nous recherchons actuellement :</p>
    <p style="margin: 0 0 14px 0; color: #202124;">
      ${safeFocus}
    </p>

    <p style="margin: 0 0 14px 0;">
      ${safeQuestion}
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
      Si vous avez des machines disponibles, vous pouvez me répondre directement par e-mail ou m'appeler au <a href="tel:${safePhone}" style="color: #1a73e8; text-decoration: none;">${safePhone}</a>.
    </p>

    <p style="margin: 0 0 20px 0;">Meilleures salutations,</p>

    <!-- Native Gmail Signature -->
    <table cellpadding="0" cellspacing="0" border="0" style="font-family: Arial, Helvetica, sans-serif; font-size: 13px; color: #202124; line-height: 1.4;">
      <tr>
        <td style="vertical-align: top; padding-right: 12px;">
          <img src="cid:jimy_export_profile_pic" alt="JIMY EXPORT" width="48" height="48" style="width: 48px; height: 48px; border-radius: 50%; display: block; object-fit: cover;" />
        </td>
        <td style="vertical-align: top; border-left: 1px solid #dadce0; padding-left: 12px;">
          <div style="font-weight: bold; color: #202124; font-size: 13px;">${safeName}</div>
          <div style="color: #5f6368; font-size: 12px;">JIMY EXPORT · Négoce de camions et machines de chantier</div>
          <div style="color: #5f6368; font-size: 12px; margin-top: 2px;">
            <a href="tel:${safePhone}" style="color: #1a73e8; text-decoration: none;">${safePhone}</a> · <a href="mailto:${safeEmail}" style="color: #1a73e8; text-decoration: none;">${safeEmail}</a>
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
