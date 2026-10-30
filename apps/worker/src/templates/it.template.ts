import { TemplateParams } from './de.template.ts';

export function generateItTemplate(params: TemplateParams) {
  const salutation = params.recipientName
    ? `Gentile Signor/Signora ${params.recipientName},`
    : `Spettabile Direzione Macchine e Cantieri di ${params.companyName},`;

  let hookItems: string[] = [];
  if (params.hooks.cash_settlement) {
    hookItems.push('• Pagamento immediato tramite bonifico bancario prima del ritiro');
  }
  if (params.hooks.transport_covered) {
    hookItems.push('• Presa a carico completa del trasporto eccezionale e della logistica direttamente dal vostro piazzale');
  }
  if (params.hooks.as_is) {
    hookItems.push('• Acquisto nello stato di fatto (visto e piaciuto), senza alcuna garanzia post-vendita richiesta');
  }

  const focus = params.equipmentFocus || 'Escavatori cingolati 15–30t, camion 4 assi ribaltabili, pale gommate, frantoi';

  const subject = `Richiesta ritiro macchine movimento terra e rinnovo parco — ${params.companyName}`;

  const body = `${salutation}

Siamo una società commerciale svizzera specializzata nell'acquisizione e intermediazione di macchinari pesanti e attrezzature da cantiere.

Nell'ambito di commesse di lavoro in Svizzera e all'estero, siamo attualmente alla ricerca di macchinari pronti per la cessione:
${focus}

Avete in programma a breve termine in Ticino (${params.canton}) la sostituzione o dismissione di mezzi dal vostro parco macchine?

I nostri vantaggi operativi:
${hookItems.join('\n')}

Restiamo volentieri a disposizione per un breve riscontro – anche via e-mail con una lista delle macchine disponibili o telefonicamente al ${params.senderPhone}.

Cordiali saluti,

${params.senderName}
JimiScout BTP — Acquisizione Macchine da Cantiere Svizzera
E-mail: ${params.senderEmail}
Telefono: ${params.senderPhone}

-------------------------------------------------------
Conformità & Disiscrizione (Legge federale sulla protezione dei dati LPD):
Se non desidera ricevere ulteriori comunicazioni commerciali da parte nostra, risponda semplicemente 'STOP' o 'CANCELLA'. Il suo indirizzo verrà immediatamente disattivato.`;

  return { subject, body };
}
