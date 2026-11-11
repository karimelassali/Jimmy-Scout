import { AgentAction, SwissLanguage } from '@/packages/types/src/database.ts';
import { supabaseDataService } from './supabase.service.ts';
import { smtpService } from './smtp.service.ts';
import { telegramService } from './telegram.service.ts';
import { isSwissBusinessHours } from '../scheduler.ts';

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let left = days;
  while (left > 0) {
    result.setUTCDate(result.getUTCDate() + 1);
    const weekday = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Zurich', weekday: 'short' }).format(result) !== 'Sat' && new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Zurich', weekday: 'short' }).format(result) !== 'Sun');
    if (weekday) left--;
  }
  result.setUTCHours(8, 15, 0, 0);
  return result;
}

function followUpCopy(language: SwissLanguage, final: boolean, companyName: string) {
  if (language === 'de') return {
    subject: final ? 'Letzte kurze Anfrage zu Ihren Baumaschinen' : 'Kurze Nachfrage zu Ihren Baumaschinen',
    body: `Guten Tag ${companyName},\n\nwir wollten kurz nachfragen, ob Sie derzeit gebrauchte Baumaschinen oder Nutzfahrzeuge verkaufen. Wir entscheiden schnell und organisieren den Transport.\n\nFalls dies nicht aktuell ist, genügt eine kurze Antwort.\n\nFreundliche Grüsse`,
  };
  if (language === 'it') return {
    subject: final ? 'Ultima breve richiesta sui vostri macchinari' : 'Breve seguito sui vostri macchinari',
    body: `Buongiorno ${companyName},\n\nvolevamo sapere se avete macchine edili o veicoli usati da vendere. Decidiamo rapidamente e organizziamo il trasporto.\n\nSe non è il momento giusto, basta una breve risposta.\n\nCordiali saluti`,
  };
  return {
    subject: final ? 'Dernière demande au sujet de vos machines' : 'Petit suivi au sujet de vos machines',
    body: `Bonjour ${companyName},\n\nNous revenons vers vous pour savoir si vous avez des machines de chantier ou des véhicules d’occasion à vendre. Nous décidons vite et organisons le transport.\n\nSi ce n’est pas le bon moment, une courte réponse suffit.\n\nMeilleures salutations`,
  };
}

export class AgentOrchestratorService {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  async scheduleFollowUps(log: { company_id: string; recipient_email?: string; company_name?: string; language: SwissLanguage; sent_at: string }) {
    const settings = await supabaseDataService.getSettings();
    const mode = settings.feature_controls.follow_ups;
    if (mode === 'off' || !log.recipient_email) return [];
    return Promise.all([
      supabaseDataService.createAgentAction({
        type: 'follow_up_1', status: mode === 'auto' ? 'scheduled' : 'pending_approval',
        company_id: log.company_id, recipient_email: log.recipient_email,
        title: `Premier suivi · ${log.company_name || log.recipient_email}`,
        reason: 'Aucune réponse reçue après le premier courriel.',
        rule: `Après ${settings.follow_up_first_business_days} jours ouvrés, sauf réponse, rebond ou arrêt.`,
        payload: { language: log.language, companyName: log.company_name || log.recipient_email },
        scheduled_for: addBusinessDays(new Date(log.sent_at), settings.follow_up_first_business_days).toISOString(),
      }),
      supabaseDataService.createAgentAction({
        type: 'follow_up_final', status: mode === 'auto' ? 'scheduled' : 'pending_approval',
        company_id: log.company_id, recipient_email: log.recipient_email,
        title: `Dernier suivi · ${log.company_name || log.recipient_email}`,
        reason: 'Aucune réponse reçue après les messages précédents.',
        rule: `Après ${settings.follow_up_final_business_days} jours ouvrés, puis aucun autre suivi.`,
        payload: { language: log.language, companyName: log.company_name || log.recipient_email },
        scheduled_for: addBusinessDays(new Date(log.sent_at), settings.follow_up_final_business_days).toISOString(),
      }),
    ]);
  }

  async scheduleQualification(leadId: string, email: string, subject: string, body: string) {
    const settings = await supabaseDataService.getSettings();
    const mode = settings.feature_controls.qualification;
    if (mode === 'off') return null;
    return supabaseDataService.createAgentAction({
      type: 'qualification_reply', status: mode === 'auto' ? 'scheduled' : 'pending_approval',
      lead_id: leadId, recipient_email: email, title: `Demander les informations manquantes`,
      reason: 'Le dossier ne contient pas assez d’informations pour décider.',
      rule: 'Envoyer seulement si des informations importantes manquent.',
      payload: { subject, body }, scheduled_for: new Date().toISOString(),
    });
  }

  private async sendEmailAction(action: AgentAction) {
    const settings = await supabaseDataService.getSettings();
    const sentToday = await supabaseDataService.getTodaySentCount(new Date());
    if (sentToday >= settings.daily_limit) {
      await supabaseDataService.updateAgentAction(action.id, {
        status: 'scheduled',
        scheduled_for: addBusinessDays(new Date(), 1).toISOString(),
        error: 'Limite du jour atteinte. Action reportée.',
      });
      return;
    }
    if (!action.recipient_email) throw new Error('Adresse du destinataire absente.');
    const suppressed = await supabaseDataService.isEmailOrDomainSuppressed(action.recipient_email);
    if (suppressed) {
      await supabaseDataService.updateAgentAction(action.id, { status: 'cancelled', error: 'Adresse bloquée.' });
      return;
    }
    const leads = await supabaseDataService.getLeads(true);
    if (action.type !== 'qualification_reply' && leads.some((lead) => lead.sender_email.toLowerCase() === action.recipient_email!.toLowerCase())) {
      await supabaseDataService.updateAgentAction(action.id, { status: 'cancelled', error: 'Réponse déjà reçue.' });
      return;
    }
    const language = (action.payload.language || 'fr') as SwissLanguage;
    const copy = action.type === 'qualification_reply'
      ? { subject: String(action.payload.subject || ''), body: String(action.payload.body || '') }
      : followUpCopy(language, action.type === 'follow_up_final', String(action.payload.companyName || ''));
    const result = await smtpService.sendMail({
      to: action.recipient_email, subject: copy.subject, text: copy.body,
      fromName: `${settings.sender_name} - JIMY EXPORT`, replyTo: settings.sender_email,
    });
    if (!result.success) throw new Error(result.error || 'Envoi impossible.');
    await supabaseDataService.addOutboundLog({
      company_id: action.company_id || 'agent-action', language, subject: copy.subject,
      body_snippet: copy.body.slice(0, 180), full_body: copy.body,
      recipient_email: action.recipient_email, company_name: String(action.payload.companyName || ''),
      delivery_status: result.deliveryStatus || 'accepted', smtp_message_id: result.messageId || null,
    });
    await supabaseDataService.updateAgentAction(action.id, { status: 'completed', completed_at: new Date().toISOString(), error: null });
  }

  private async ensureDailyBriefing(now: Date) {
    const settings = await supabaseDataService.getSettings();
    const mode = settings.feature_controls.daily_briefing;
    if (mode === 'off') return;
    const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Zurich' }).format(now);
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', hour12: false }).format(now));
    const existing = (await supabaseDataService.getAgentActions()).some((item) => item.type === 'daily_briefing' && item.payload.date === date);
    if (existing || hour < settings.daily_briefing_hour) return;
    await supabaseDataService.createAgentAction({
      type: 'daily_briefing', status: mode === 'auto' ? 'scheduled' : 'pending_approval',
      title: `Résumé Jimy · ${date}`, reason: 'Résumé quotidien des affaires et actions.',
      rule: `Chaque jour à partir de ${settings.daily_briefing_hour} h.`, payload: { date }, scheduled_for: now.toISOString(),
    });
  }

  private async sendBriefing(action: AgentAction) {
    const [leads, actions] = await Promise.all([supabaseDataService.getLeads(), supabaseDataService.getAgentActions()]);
    const hot = leads.filter((lead) => (lead.deal_score || 0) >= 70).slice(0, 5);
    const pending = actions.filter((item) => item.status === 'pending_approval').length;
    const text = `<b>Résumé de Jimy</b>\n\n🎯 ${hot.length} dossier(s) avec un score de 70 ou plus\n⏳ ${pending} action(s) à valider\n📁 ${leads.length} dossier(s) actif(s)\n\n${hot.map((lead) => `• ${lead.company_name}: ${lead.deal_score}/100`).join('\n') || 'Aucune affaire prioritaire aujourd’hui.'}`;
    const result = await telegramService.sendText(text);
    if (!result.success) throw new Error(result.error || 'Résumé Telegram impossible.');
    await supabaseDataService.updateAgentAction(action.id, { status: 'completed', completed_at: new Date().toISOString(), error: null });
  }

  async tick(now = new Date()) {
    if (this.running) return;
    this.running = true;
    try {
      const settings = await supabaseDataService.getSettings();
      if (!settings.is_active) return;
      await this.ensureDailyBriefing(now);
      const due = (await supabaseDataService.getAgentActions())
        .filter((item) => item.status === 'scheduled' && new Date(item.scheduled_for).getTime() <= now.getTime())
        .sort((a, b) => new Date(a.scheduled_for).getTime() - new Date(b.scheduled_for).getTime());
      for (const action of due.slice(0, 2)) {
        try {
          const mode = action.type === 'daily_briefing'
            ? settings.feature_controls.daily_briefing
            : action.type === 'qualification_reply'
              ? settings.feature_controls.qualification
              : settings.feature_controls.follow_ups;
          if (mode === 'off') {
            await supabaseDataService.updateAgentAction(action.id, { status: 'cancelled', error: 'Fonction arrêtée dans les réglages.' });
            continue;
          }
          if (mode === 'approval' && action.payload.approvedByUser !== true) {
            await supabaseDataService.updateAgentAction(action.id, { status: 'pending_approval', error: null });
            continue;
          }
          if (action.type === 'daily_briefing') await this.sendBriefing(action);
          else if (isSwissBusinessHours(now)) await this.sendEmailAction(action);
        } catch (err: any) {
          await supabaseDataService.updateAgentAction(action.id, { status: 'failed', error: err?.message || 'Action impossible.' });
        }
      }
    } catch (err: any) {
      console.warn('[AgentOrchestrator] Tick warning:', err?.message || err);
    } finally { this.running = false; }
  }

  startDaemonLoop(intervalMs = 60_000) {
    if (this.timer) return;
    void this.tick().catch(() => {});
    this.timer = setInterval(() => void this.tick().catch(() => {}), intervalMs);
  }
}

export const agentOrchestrator = new AgentOrchestratorService();
