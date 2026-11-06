import { supabaseDataService } from './supabase.service.ts';
import { smtpService } from './smtp.service.ts';
import {
  getNextSwissBusinessWindowStart,
  getRandomJitterMs,
  isEligibleForOutbound,
  isSwissBusinessHours,
  resolveCompanyLanguage,
} from '../scheduler.ts';
import { generateDeTemplate } from '../templates/de.template.ts';
import { generateFrTemplate } from '../templates/fr.template.ts';
import { generateItTemplate } from '../templates/it.template.ts';
import { OutboundLog, SchedulerStatus } from '@/packages/types/src/database.ts';
import { agentOrchestrator } from './agent-orchestrator.service.ts';

export interface OutboundStepOptions {
  referenceDate?: Date;
  bypassBusinessHours?: boolean;
  manualOverride?: boolean;
  companyId?: string;
  respectNextSendAt?: boolean;
}

export interface OutboundStepResult {
  status:
    | 'dispatched'
    | 'paused'
    | 'waiting_for_hours'
    | 'waiting_for_jitter'
    | 'quota_reached'
    | 'idle'
    | 'busy'
    | 'smtp_error';
  message: string;
  company?: string;
  email?: string;
  canton?: string;
  language?: string;
  messageId?: string;
  todaySentCount?: number;
  dailyLimit?: number;
  nextSendAt?: string | null;
  log?: OutboundLog;
  error?: string;
}

export class OutboundSchedulerService {
  private timerHandle: NodeJS.Timeout | null = null;
  private isRunningLoop = false;

  async getStatus(referenceDate = new Date()): Promise<SchedulerStatus> {
    const [settings, companies, suppressions, todaySent, meta] = await Promise.all([
      supabaseDataService.getSettings(),
      supabaseDataService.getCompanies(),
      supabaseDataService.getSuppressions(),
      supabaseDataService.getTodaySentCount(referenceDate),
      supabaseDataService.getSchedulerMeta(),
    ]);

    const inHours = isSwissBusinessHours(referenceDate);
    const nowMs = referenceDate.getTime();

    const eligibleList = companies.filter(
      (c) =>
        settings.selected_cantons.includes(c.canton) &&
        isEligibleForOutbound(c.last_contacted_at, c.unsubscribed, {
          email: c.email,
          verifiedEmail: c.verified_email,
          suppressions,
          claimedAt: c.claimed_at,
          nowMs,
        })
    );

    const remainingQuota = Math.max(0, settings.daily_limit - todaySent);
    const queueDepth = Math.min(eligibleList.length, remainingQuota);

    let state: SchedulerStatus['state'] = 'paused';
    let nextSendAt = meta.next_send_at || null;

    if (!settings.is_active || !settings.outreach_active) {
      state = 'paused';
      nextSendAt = null;
    } else if (meta.last_error) {
      state = 'failed';
    } else if (todaySent >= settings.daily_limit) {
      state = 'quota_reached';
      // Next window is tomorrow's Swiss business hours start
      const tomorrow = new Date(referenceDate.getTime() + 18 * 60 * 60 * 1000);
      nextSendAt = getNextSwissBusinessWindowStart(tomorrow).toISOString();
    } else if (!inHours) {
      state = 'waiting_for_hours';
      nextSendAt = getNextSwissBusinessWindowStart(referenceDate).toISOString();
    } else if (eligibleList.length === 0) {
      state = 'blocked';
      nextSendAt = null;
    } else {
      state = 'enabled';
      if (!nextSendAt || new Date(nextSendAt).getTime() < nowMs) {
        nextSendAt = referenceDate.toISOString();
      }
    }

    return {
      state,
      is_active: settings.is_active,
      is_swiss_business_hours: inHours,
      swiss_time: referenceDate.toISOString(),
      today_sent: todaySent,
      daily_limit: settings.daily_limit,
      eligible_count: eligibleList.length,
      queue_depth: queueDepth,
      last_heartbeat_at: meta.last_heartbeat_at || referenceDate.toISOString(),
      last_run_at: meta.last_run_at || null,
      next_send_at: nextSendAt,
      last_error: meta.last_error || null,
    };
  }

  /**
   * Executes a single atomic outreach step:
   * 1. Verifies active toggle & Swiss business hours (08:30-17:00 Europe/Zurich, Mon-Fri)
   * 2. Atomically claims next eligible contractor & reserves daily quota
   * 3. Creates transactional 'sending' log entry
   * 4. Dispatches email via SMTP with contractor's verified language & tone
   * 5. Finalizes log ('accepted' / 'simulated' / 'bounced' / 'failed') and schedules next jitter timestamp
   */
  async executeStep(options?: OutboundStepOptions): Promise<OutboundStepResult> {
    return this.executeDispatchStep(options);
  }

  async executeDispatchStep(options?: OutboundStepOptions): Promise<OutboundStepResult> {
    const refDate = options?.referenceDate || new Date();
    // A dashboard/manual run may skip the randomized delay, but it must never
    // bypass the legal/safety delivery window. Only explicit internal test or
    // maintenance calls may opt out of the business-hours guard.
    const bypassHours = Boolean(options?.bypassBusinessHours);
    const settings = await supabaseDataService.getSettings();

    if (!settings.is_active || !settings.outreach_active) {
      return {
        status: 'paused',
        message: 'Les envois sont en pause. Activez Jimy et l’envoi automatique.',
      };
    }

    // A transport failure means the configured mailbox is not currently
    // reachable. The daemon must stop here instead of producing one failed
    // outbound record every minute. A deliberate manual retry can still be
    // used after SMTP has been fixed.
    if (options?.respectNextSendAt) {
      const meta = await supabaseDataService.getSchedulerMeta();
      if (meta.last_error) {
        return {
          status: 'smtp_error',
          error: meta.last_error,
          message: `Envois suspendus : ${meta.last_error}`,
        };
      }
    }

    // Enforce Swiss business hours consistently
    if (!bypassHours && !isSwissBusinessHours(refDate)) {
      const nextWindow = getNextSwissBusinessWindowStart(refDate).toISOString();
      await supabaseDataService.updateSchedulerMeta({
        last_heartbeat_at: refDate.toISOString(),
        next_send_at: nextWindow,
      });
      return {
        status: 'waiting_for_hours',
        nextSendAt: nextWindow,
        message: `En attente : les envois sont permis du lundi au vendredi, de 08 h 30 à 17 h 00, heure de Zurich. Prochaine ouverture : ${nextWindow}`,
      };
    }

    // If running from background scheduler tick, respect randomized jitter spacing
    if (options?.respectNextSendAt) {
      const meta = await supabaseDataService.getSchedulerMeta();
      if (meta.next_send_at) {
        const nextMs = new Date(meta.next_send_at).getTime();
        if (!isNaN(nextMs) && refDate.getTime() < nextMs) {
          return {
            status: 'waiting_for_jitter',
            nextSendAt: meta.next_send_at,
            message: `En attente du prochain envoi prévu à ${meta.next_send_at}`,
          };
        }
      }
    }

    // Atomically claim next eligible contractor & reserve quota
    const claim = await supabaseDataService.claimNextEligibleCompany({
      referenceDate: refDate,
      companyId: options?.companyId,
    });

    if (!claim.claimed || !claim.company) {
      if (claim.reason === 'busy') {
        return {
          status: 'busy',
          message: 'Un autre envoi est déjà en cours.',
        };
      }
      if (claim.reason === 'quota_reached') {
        return {
          status: 'quota_reached',
          todaySentCount: claim.todaySentCount,
          dailyLimit: settings.daily_limit,
          message: `Limite du jour atteinte (${claim.todaySentCount}/${settings.daily_limit}).`,
        };
      }
      return {
        status: 'idle',
        todaySentCount: claim.todaySentCount,
        dailyLimit: settings.daily_limit,
        message:
          'No eligible contractor waiting in the selected cantons (all contacted within 30 days, unverified, or suppressed).',
      };
    }

    const company = claim.company;
    const lang = resolveCompanyLanguage(company);

    const templateParams = {
      companyName: company.name,
      recipientName: company.contact_person || undefined,
      canton: company.canton,
      senderName: settings.sender_name,
      senderEmail: settings.sender_email,
      senderPhone: settings.sender_phone,
      tone: settings.tone,
      hooks: settings.hooks,
      equipmentFocus: settings.equipment_focus,
    };

    const rendered =
      lang === 'fr'
        ? generateFrTemplate(templateParams)
        : lang === 'it'
        ? generateItTemplate(templateParams)
        : generateDeTemplate(templateParams);

    // Transactional outbox: record 'sending' state before transport call
    const pendingLog = await supabaseDataService.addOutboundLog({
      company_id: company.id,
      sent_at: refDate.toISOString(),
      language: lang,
      subject: rendered.subject,
      body_snippet: rendered.body.substring(0, 180),
      full_body: rendered.body,
      html_body: rendered.html,
      sender_email: settings.sender_email,
      recipient_email: company.email,
      company_name: company.name,
      canton: company.canton,
      delivery_status: 'sending',
      is_test: false,
    });

    try {
      const sendResult = await smtpService.sendMail({
        to: company.email,
        subject: rendered.subject,
        text: rendered.body,
        html: rendered.html,
        fromName: `${settings.sender_name} - JIMY EXPORT`,
        replyTo: settings.sender_email,
      });

      if (!sendResult.success) {
        const failStatus = sendResult.deliveryStatus || 'failed';
        const updatedFailedLog = await supabaseDataService.updateOutboundLogStatus(
          pendingLog.id,
          {
            delivery_status: failStatus,
            body_snippet: `SMTP Error: ${sendResult.error}`,
            error_message: sendResult.error || 'SMTP send failed',
          }
        );

        await supabaseDataService.releaseCompanyClaim(company.id);
        await supabaseDataService.updateSchedulerMeta({
          last_heartbeat_at: refDate.toISOString(),
          last_run_at: refDate.toISOString(),
          last_error: sendResult.error || 'SMTP dispatch failed',
        });

        return {
          status: 'smtp_error',
          company: company.name,
          email: company.email,
          canton: company.canton,
          language: lang,
          error: sendResult.error,
          log: updatedFailedLog || pendingLog,
          message: `Échec de l’envoi à ${company.email} : ${sendResult.error}`,
        };
      }

      const finalStatus =
        sendResult.deliveryStatus === 'simulated' ? 'simulated' : 'accepted';

      const finalizedLog = await supabaseDataService.updateOutboundLogStatus(pendingLog.id, {
        delivery_status: finalStatus,
        smtp_message_id: sendResult.messageId || null,
        error_message: null,
      });

      await agentOrchestrator.scheduleFollowUps({
        company_id: company.id,
        recipient_email: company.email,
        company_name: company.name,
        language: lang,
        sent_at: refDate.toISOString(),
      });

      const contactedIso = refDate.toISOString();
      await supabaseDataService.releaseCompanyClaim(company.id, contactedIso);

      // Schedule next attempt with real randomized jitter (8-18 mins)
      const jitterMs = getRandomJitterMs();
      const candidateNext = new Date(refDate.getTime() + jitterMs);
      const nextValidTime = isSwissBusinessHours(candidateNext)
        ? candidateNext
        : getNextSwissBusinessWindowStart(candidateNext);

      await supabaseDataService.updateSchedulerMeta({
        last_heartbeat_at: contactedIso,
        last_run_at: contactedIso,
        next_send_at: nextValidTime.toISOString(),
        last_error: null,
      });

      const updatedTodayCount = await supabaseDataService.getTodaySentCount(refDate);

      return {
        status: 'dispatched',
        company: company.name,
        email: company.email,
        canton: company.canton,
        language: lang,
        messageId: sendResult.messageId,
        todaySentCount: updatedTodayCount,
        dailyLimit: settings.daily_limit,
        nextSendAt: nextValidTime.toISOString(),
        log: finalizedLog || pendingLog,
        message: `Courriel accepté pour ${company.name} (${company.email})`,
      };
    } catch (err: any) {
      await supabaseDataService.updateOutboundLogStatus(pendingLog.id, {
        delivery_status: 'failed',
        error_message: err?.message || 'Unexpected transport failure',
      });
      await supabaseDataService.releaseCompanyClaim(company.id);
      throw err;
    }
  }

  /**
   * Starts a background scheduler tick loop for persistent server/worker deployments.
   */
  startDaemonLoop(intervalMs = 60_000): void {
    this.startBackgroundLoop(intervalMs);
  }

  startBackgroundLoop(intervalMs = 60_000): void {
    if (this.isRunningLoop) return;
    this.isRunningLoop = true;

    this.timerHandle = setInterval(async () => {
      try {
        await supabaseDataService.updateSchedulerMeta({
          last_heartbeat_at: new Date().toISOString(),
        });
        await this.executeDispatchStep({ respectNextSendAt: true });
      } catch (err: any) {
        console.warn('[Scheduler] Background tick notice:', err?.message);
      }
    }, intervalMs);
  }

  stopBackgroundLoop(): void {
    this.isRunningLoop = false;
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }
}

export const outboundScheduler = new OutboundSchedulerService();
