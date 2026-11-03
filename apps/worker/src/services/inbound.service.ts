import { supabaseDataService } from './supabase.service.ts';
import { geminiService } from './gemini.service.ts';
import { telegramService } from './telegram.service.ts';
import { computeDurableMessageKey, extractLatestReplyText } from './imap.service.ts';
import { InboundLead } from '@/packages/types/src/lead.ts';
import { ALL_SWISS_CANTONS } from '@/packages/types/src/swiss.ts';
import { dealIntelligenceService } from './deal-intelligence.service.ts';
import { agentOrchestrator } from './agent-orchestrator.service.ts';

export interface ProcessInboundEmailInput {
  senderEmail: string;
  companyName?: string;
  canton?: string;
  rawSubject: string;
  rawBody: string;
  latestReplyText?: string;
  messageId?: string | null;
  inReplyTo?: string | null;
  references?: string[];
  uid?: number | null;
  imapUid?: number | null;
  uidValidity?: string | null;
  isBounce?: boolean;
  isBounceReport?: boolean;
  bouncedRecipient?: string;
  receivedAt?: string;
  source?: string;
}

export interface ProcessInboundEmailResult {
  status:
    | 'processed'
    | 'duplicate'
    | 'deleted_ignored'
    | 'self_ignored'
    | 'bounce_handled'
    | 'unsubscribed'
    | 'not_interested_cooldown'
    | 'out_of_office'
    | 'irrelevant';
  analysis: any;
  lead: InboundLead | null;
  telegram?: any;
  isDuplicate: boolean;
  isDeleted?: boolean;
  messageKey: string;
}

function inferCantonFromText(text: string, fallback = 'CH'): string {
  const upper = text.toUpperCase();
  for (const canton of ALL_SWISS_CANTONS) {
    if (
      upper.includes(canton.name.toUpperCase()) ||
      upper.includes(canton.nameDe.toUpperCase()) ||
      upper.includes(canton.nameFr.toUpperCase()) ||
      upper.includes(canton.nameIt.toUpperCase())
    ) {
      return canton.code;
    }
  }
  return fallback;
}

export class InboundProcessingService {
  async processInboundMessage(
    params: ProcessInboundEmailInput
  ): Promise<ProcessInboundEmailResult> {
    return this.processInboundEmail({
      ...params,
      uid: params.uid ?? params.imapUid,
      isBounce: params.isBounce ?? params.isBounceReport,
    });
  }

  async processInboundEmail(
    params: ProcessInboundEmailInput
  ): Promise<ProcessInboundEmailResult> {
    const senderEmail = (params.senderEmail || '').trim().toLowerCase();
    const rawSubject = (params.rawSubject || '(No Subject)').trim();
    const rawBody = (params.rawBody || '').trim();
    const latestReplyText =
      params.latestReplyText?.trim() || extractLatestReplyText(rawBody);

    const messageKey = computeDurableMessageKey({
      messageId: params.messageId,
      uidValidity: params.uidValidity,
      uid: params.uid,
      senderEmail,
      subject: rawSubject,
      bodyText: rawBody,
    });

    // 1. Self-email guard
    const myImapUser = (process.env.IMAP_USER || '').trim().toLowerCase();
    const mySmtpUser = (process.env.SMTP_USER || '').trim().toLowerCase();
    const settings = await supabaseDataService.getSettings();
    const configuredSender = (settings.sender_email || '').trim().toLowerCase();

    if (
      senderEmail === myImapUser ||
      senderEmail === mySmtpUser ||
      (configuredSender && senderEmail === configuredSender)
    ) {
      return {
        status: 'self_ignored',
        analysis: { intent: 'SELF_IGNORE' },
        lead: null,
        isDuplicate: true,
        messageKey,
      };
    }

    // 2. Atomic message claim (prevents concurrent duplicate processing & deleted lead resurrection)
    const claim = await supabaseDataService.claimInboundMessage({
      messageKey,
      senderEmail,
      subject: rawSubject,
      rawBody,
    });

    if (!claim.claimed) {
      if (claim.reason === 'deleted') {
        return {
          status: 'deleted_ignored',
          analysis: { intent: 'DELETED_IGNORE' },
          lead: null,
          isDuplicate: true,
          isDeleted: true,
          messageKey,
        };
      }
      return {
        status: 'duplicate',
        analysis: { intent: claim.existingLead?.intent || 'DUPLICATE' },
        lead: claim.existingLead || null,
        isDuplicate: true,
        messageKey,
      };
    }

    try {
      // 3. Handle Bounce / DSN Notifications
      if (params.isBounce) {
        const bouncedAddr = (params.bouncedRecipient || '').trim().toLowerCase();
        if (bouncedAddr) {
          await supabaseDataService.cancelAgentActionsForRecipient(bouncedAddr, 'Rebond reçu.');
          await supabaseDataService.addSuppression({
            email: bouncedAddr,
            reason: 'hard_bounce',
            source: 'imap_dsn',
            notes: `Bounce DSN: ${rawSubject}`,
          });
          const logs = await supabaseDataService.getOutboundLogs();
          const matchingLog = logs.find(
            (l) => l.recipient_email?.toLowerCase() === bouncedAddr
          );
          if (matchingLog) {
            await supabaseDataService.updateOutboundLogStatus(matchingLog.id, {
              delivery_status: 'bounced',
              error_message: rawSubject,
            });
          }
        }
        await supabaseDataService.completeInboundMessage(messageKey, null);
        return {
          status: 'bounce_handled',
          analysis: { intent: 'IRRELEVANT', french_summary: 'Notification de rebond (bounce) traitée.' },
          lead: null,
          isDuplicate: false,
          messageKey,
        };
      }

      // Any real reply stops all pending follow-ups to this address.
      await supabaseDataService.cancelAgentActionsForRecipient(senderEmail, 'Le vendeur a répondu.');

      // 4. Match existing contractor in directory
      const existingCompany = await supabaseDataService.findCompanyByEmail(senderEmail);
      const companyName =
        params.companyName?.trim() ||
        existingCompany?.name ||
        senderEmail.split('@')[0] ||
        senderEmail;

      let canton = (params.canton?.trim() || existingCompany?.canton || '').toUpperCase();
      if (!canton || canton === 'CH') {
        canton = inferCantonFromText(`${rawSubject} ${latestReplyText}`, 'CH');
      }

      // 5. Analyze latest reply text with Gemini (with untrusted data boundaries & runtime validation)
      const analysis = await geminiService.analyzeReply(
        rawSubject,
        latestReplyText || rawBody,
        senderEmail
      );

      // 6. Route by Intent:
      // 6a. UNSUBSCRIBE -> Permanent durable suppression (even for unknown senders!)
      if (analysis.intent === 'UNSUBSCRIBE') {
        await supabaseDataService.addSuppression({
          email: senderEmail,
          reason: 'unsubscribe_reply',
          source: 'inbound_email',
          notes: `Reply: "${latestReplyText.slice(0, 120)}"`,
        });
        if (existingCompany) {
          await supabaseDataService.updateCompany(existingCompany.id, {
            unsubscribed: true,
          });
        }
        await supabaseDataService.completeInboundMessage(messageKey, null);
        return {
          status: 'unsubscribed',
          analysis,
          lead: null,
          isDuplicate: false,
          messageKey,
        };
      }

      // 6b. NOT_INTERESTED ("No machines right now") -> Record cooldown & stock_status, DO NOT permanently unsubscribe!
      if (analysis.intent === 'NOT_INTERESTED') {
        if (existingCompany) {
          await supabaseDataService.updateCompany(existingCompany.id, {
            stock_status: 'no_stock_temporarily',
            last_contacted_at: new Date().toISOString(),
          });
        }
        await supabaseDataService.completeInboundMessage(messageKey, null);
        return {
          status: 'not_interested_cooldown',
          analysis,
          lead: null,
          isDuplicate: false,
          messageKey,
        };
      }

      // 6c. OUT_OF_OFFICE or IRRELEVANT -> Mark processed, do not create deal lead
      if (analysis.intent === 'OUT_OF_OFFICE' || analysis.intent === 'IRRELEVANT') {
        await supabaseDataService.completeInboundMessage(messageKey, null);
        return {
          status: analysis.intent === 'OUT_OF_OFFICE' ? 'out_of_office' : 'irrelevant',
          analysis,
          lead: null,
          isDuplicate: false,
          messageKey,
        };
      }

      // 6d. HOT_LEAD or NEEDS_REVIEW -> Persist CRM Lead & Equipment Records
      if (existingCompany) {
        await supabaseDataService.updateCompany(existingCompany.id, {
          stock_status: 'active_seller',
        });
      }

      const createdLead = await supabaseDataService.createLead({
        company_id: existingCompany?.id || null,
        company_name: companyName,
        canton,
        sender_email: senderEmail,
        raw_subject: rawSubject,
        raw_body: rawBody,
        latest_reply_text: latestReplyText,
        intent: analysis.intent,
        machinery_detected: analysis.machinery_detected || [],
        contact_name:
          analysis.contact_name ||
          existingCompany?.contact_person ||
          companyName ||
          senderEmail,
        contact_phone: analysis.contact_phone || existingCompany?.phone || null,
        lead_status: 'new',
        ai_summary: analysis.french_summary,
        match_score:
          analysis.equipment_fit_score ?? Math.round((analysis.confidence || 0.9) * 100),
        classification_confidence: analysis.confidence,
        equipment_fit_score: analysis.equipment_fit_score,
        needs_review: Boolean(analysis.needs_review),
        message_id: messageKey,
        in_reply_to: params.inReplyTo || null,
        references: params.references || [],
      });

      const enrichedLead = await dealIntelligenceService.enrichLead(createdLead);
      await supabaseDataService.updateLead(createdLead.id, enrichedLead);

      if (enrichedLead.qualification_draft && enrichedLead.qualification_subject) {
        await agentOrchestrator.scheduleQualification(
          enrichedLead.id,
          enrichedLead.sender_email,
          enrichedLead.qualification_subject,
          enrichedLead.qualification_draft
        );
      }

      if (enrichedLead.watchlist_matches?.length) {
        const settingsNow = await supabaseDataService.getSettings();
        if (settingsNow.feature_controls.watchlists !== 'off') {
          await supabaseDataService.createAgentAction({
            type: 'watchlist_match',
            status: 'completed',
            lead_id: enrichedLead.id,
            recipient_email: enrichedLead.sender_email,
            title: `Machine trouvée · ${enrichedLead.watchlist_matches.join(', ')}`,
            reason: 'Cette machine respecte une liste de recherche active.',
            rule: 'Comparer le type, le canton, l’année, les heures et le prix.',
            payload: { matches: enrichedLead.watchlist_matches },
            scheduled_for: new Date().toISOString(),
            completed_at: new Date().toISOString(),
          });
        }
      }

      // 7. Send Telegram notification for HOT_LEAD (and record attempt on lead)
      let telegramResult: any = null;
      if (
        analysis.intent === 'HOT_LEAD' &&
        !analysis.needs_review
      ) {
        telegramResult = await telegramService.sendDealNotification({
          leadId: enrichedLead.id,
          companyName,
          canton,
          machinery: analysis.machinery_detected,
          askingPrice: analysis.machinery_detected[0]?.asking_price || undefined,
          sellerName: analysis.contact_name || companyName,
          sellerPhone: analysis.contact_phone || existingCompany?.phone || undefined,
          sellerEmail: senderEmail,
          summary: analysis.french_summary,
        });

        await supabaseDataService.updateLead(enrichedLead.id, {
          telegram_notified_at: telegramResult.success ? new Date().toISOString() : null,
          telegram_error: telegramResult.success ? null : telegramResult.error || 'Telegram failed',
        });
      }

      await supabaseDataService.completeInboundMessage(messageKey, enrichedLead.id);

      return {
        status: 'processed',
        analysis,
        lead: enrichedLead,
        telegram: telegramResult,
        isDuplicate: false,
        messageKey,
      };
    } catch (err: any) {
      await supabaseDataService.failInboundMessage(
        messageKey,
        err?.message || 'Inbound processing failed'
      );
      throw err;
    }
  }
}

export const inboundService = new InboundProcessingService();
