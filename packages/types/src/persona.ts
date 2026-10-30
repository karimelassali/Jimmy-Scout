import { SwissLanguage, ToneType } from './database.ts';

export interface EmailTemplatePayload {
  language: SwissLanguage;
  recipientName: string;
  companyName: string;
  canton: string;
  subject: string;
  bodyText: string;
  senderName: string;
  senderPhone: string;
  senderEmail: string;
  optOutFooter: string;
}

export interface TonePreset {
  id: ToneType;
  title: string;
  subtitle: string;
  description: string;
  sampleSalutation: Record<SwissLanguage, string>;
}
