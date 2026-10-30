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

export function generateDeTemplate(params: TemplateParams) {
  const salutation = params.recipientName
    ? `Sehr geehrte(r) Herr/Frau ${params.recipientName},`
    : `Sehr geehrte Geschäftsleitung der ${params.companyName},`;

  let hookItems: string[] = [];
  if (params.hooks.cash_settlement) {
    hookItems.push('• Unmittelbare Barzahlung oder Sofortüberweisung vor Übernahme');
  }
  if (params.hooks.transport_covered) {
    hookItems.push('• Vollständige Abwicklung und Kostenübernahme des Schwertransports ab Werkhof');
  }
  if (params.hooks.as_is) {
    hookItems.push('• Kauf im Ist-Zustand ab Platz, ohne nachträgliche Gewährleistungsansprüche');
  }

  const focus = params.equipmentFocus || 'Raupenbagger 15–30t, 4-Achs Kipper, Radlader, Mobilbrecher';

  const subject = `Anfrage Übernahme Baumaschinen / Flottenausmusterung — ${params.companyName}`;

  const body = `${salutation}

Wir sind ein spezialisiertes Schweizer Handelsunternehmen für gebrauchte Schwermaschinen und Tiefbaugeräte mit Sitz in der Schweiz.

Im Rahmen laufender Export- und Beschaffungsaufträge für Schweizer Bauunternehmungen suchen wir derzeit kurzfristig verfügbare Maschinen:
${focus}

Planen Sie in nächster Zeit im Kanton ${params.canton} die Ausmusterung oder den Ersatz einzelner Baugeräte aus Ihrem Maschinenpark?

Ihre Vorteile bei JimiScout:
${hookItems.join('\n')}

Über eine kurze Rückmeldung – gerne auch mit einer Liste aktueller Überbestände oder telefonisch unter ${params.senderPhone} – würden wir uns sehr freuen.

Freundliche Grüsse

${params.senderName}
JimiScout BTP — Schwermaschinenbeschaffung Schweiz
E-Mail: ${params.senderEmail}
Telefon: ${params.senderPhone}

-------------------------------------------------------
Konformität & Opt-out (Schweizer Datenschutzgesetz):
Falls Sie keine weiteren Maschinenankaufsanfragen von uns wünschen, antworten Sie einfach mit 'STOP' oder 'Abmelden'. Ihre Adresse wird umgehend gesperrt.`;

  return { subject, body };
}
