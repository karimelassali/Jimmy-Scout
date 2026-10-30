import { TemplateParams } from './de.template.ts';

export function generateFrTemplate(params: TemplateParams) {
  const salutation = params.recipientName
    ? `Bonjour Monsieur/Madame ${params.recipientName},`
    : `Madame, Monsieur, Direction des Parcs de ${params.companyName},`;

  let hookItems: string[] = [];
  if (params.hooks.cash_settlement) {
    hookItems.push('• Règlement comptant / virement bancaire garanti avant enlèvement');
  }
  if (params.hooks.transport_covered) {
    hookItems.push('• Prise en charge intégrale de la logistique et du convoi exceptionnel au départ de votre dépôt');
  }
  if (params.hooks.as_is) {
    hookItems.push("• Rachat ferme en l'état, sans garantie légale requise de votre part");
  }

  const focus = params.equipmentFocus || 'Pelles sur chenilles 15–30t, camions benne 4 essieux, chargeuses, concasseurs';

  const subject = `Reprise de matériel de chantier & renouvellement de parc — ${params.companyName}`;

  const body = `${salutation}

Société suisse spécialisée dans le négoce et l'acquisition d'engins lourds de génie civil et terrassement, nous recherchons actuellement pour des chantiers partenaires en Suisse et à l'export des matériels disponibles:
${focus}

Prévoyez-vous prochainement sur votre secteur (${params.canton}) le renouvellement ou la sortie de parc de certains engins de travaux publics?

Nos engagements fermes :
${hookItems.join('\n')}

Si vous disposez de machines à libérer, vous pouvez me joindre directement par retour d'e-mail ou par téléphone au ${params.senderPhone}.

Bien cordialement,

${params.senderName}
JimiScout BTP — Négoce & Acquisition Matériel Suisse
E-mail: ${params.senderEmail}
Téléphone: ${params.senderPhone}

-------------------------------------------------------
Conformité & Désinscription (Loi fédérale sur la protection des données LPD) :
Si vous ne souhaitez plus recevoir nos sollicitations d'achat de machines, répondez simplement 'STOP' et vos coordonnées seront définitivement retirées de nos registres.`;

  return { subject, body };
}
