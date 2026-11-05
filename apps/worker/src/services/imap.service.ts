import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import crypto from 'node:crypto';
import { config } from '../config/env.ts';

export interface IncomingRawEmail {
  senderEmail: string;
  senderName?: string;
  subject: string;
  bodyText: string;
  latestReplyText: string;
  receivedAt: Date;
  messageId: string;
  inReplyTo?: string | null;
  references?: string[];
  uid?: number;
  uidValidity?: string;
  isBounce?: boolean;
  isBounceReport?: boolean;
  bouncedRecipient?: string;
}

/**
 * Strips quoted history (lines starting with ">", "On ... wrote:", "Le ... a écrit :", "Am ... schrieb")
 * so AI classification focuses on the contractor's actual latest reply while keeping full raw_body.
 */
export function extractLatestReplyText(bodyText: string): string {
  if (!bodyText) return '';
  const lines = bodyText.replace(/\r\n/g, '\n').split('\n');
  const kept: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (
      /^on .+ wrote:$/i.test(trimmed) ||
      /^le .+ a écrit\s*:$/i.test(trimmed) ||
      /^am .+ schrieb .+:$/i.test(trimmed) ||
      /^il giorno .+ ha scritto:$/i.test(trimmed) ||
      /^-----original message-----$/i.test(trimmed) ||
      /^_{5,}$/.test(trimmed) ||
      /^de\s*:\s*.+@/i.test(trimmed) ||
      /^von\s*:\s*.+@/i.test(trimmed)
    ) {
      break;
    }
    if (!trimmed.startsWith('>')) {
      kept.push(line);
    }
  }

  const cleaned = kept.join('\n').trim();
  return cleaned || bodyText.trim();
}

export function computeDurableMessageKey(params: {
  messageId?: string | null;
  uidValidity?: string | bigint | number | null;
  uid?: number | null;
  senderEmail: string;
  subject: string;
  bodyText: string;
}): string {
  if (params.messageId && params.messageId.trim()) {
    return `msgid:${params.messageId.trim().toLowerCase()}`;
  }
  if (params.uidValidity && params.uid) {
    return `imap:${String(params.uidValidity)}:${params.uid}`;
  }
  const hash = crypto
    .createHash('sha256')
    .update(
      `${params.senderEmail.trim().toLowerCase()}|${(params.subject || '').trim()}|${(
        params.bodyText || ''
      )
        .trim()
        .slice(0, 500)}`
    )
    .digest('hex')
    .slice(0, 32);
  return `hash:${hash}`;
}

export class ImapService {
  private isPollingLoopActive = false;
  private isPollInFlight = false;
  private intervalHandle: NodeJS.Timeout | null = null;
  private lastPoll: {
    attemptedAt: string | null;
    completedAt: string | null;
    success: boolean | null;
    processedCount: number;
    error: string | null;
  } = {
    attemptedAt: null,
    completedAt: null,
    success: null,
    processedCount: 0,
    error: null,
  };

  getStatus() {
    return { ...this.lastPoll, inFlight: this.isPollInFlight, active: this.isPollingLoopActive };
  }

  async pollOnce(
    onNewEmail: (email: IncomingRawEmail) => Promise<void>
  ): Promise<{
    success: boolean;
    processedCount: number;
    skippedOverlap?: boolean;
    error?: string;
  }> {
    if (this.isPollInFlight) {
      return {
        success: true,
        processedCount: 0,
        skippedOverlap: true,
      };
    }

    this.lastPoll.attemptedAt = new Date().toISOString();

    if (process.env.JIMISCOUT_STUB_EXTERNAL === 'true') {
      this.lastPoll = {
        ...this.lastPoll,
        completedAt: new Date().toISOString(),
        success: true,
        processedCount: 0,
        error: null,
      };
      return {
        success: true,
        processedCount: 0,
      };
    }

    if (!config.imap.host || !config.imap.user || !config.imap.pass) {
      const error = 'IMAP credentials (IMAP_HOST, IMAP_USER, IMAP_PASS) are not configured.';
      this.lastPoll = {
        ...this.lastPoll,
        completedAt: new Date().toISOString(),
        success: false,
        processedCount: 0,
        error,
      };
      return {
        success: false,
        processedCount: 0,
        error,
      };
    }

    this.isPollInFlight = true;

    const client = new ImapFlow({
      host: config.imap.host.trim(),
      port: config.imap.port,
      secure: true,
      auth: {
        user: config.imap.user.trim(),
        pass: config.imap.pass.trim(),
      },
      logger: false,
    });

    const parsedEmails: Array<{ email: IncomingRawEmail; uid: number }> = [];
    let processedCount = 0;

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const mailboxUidValidity = client.mailbox ? String(client.mailbox.uidValidity) : 'inbox';

        const unseenUids = (await client.search({ seen: false })) || [];
        const allUids = (await client.search({ all: true })) || [];
        const recentUids = allUids.slice(-30);

        const targetUids = Array.from(new Set([...unseenUids, ...recentUids]));

        if (targetUids.length > 0) {
          for await (const msg of client.fetch(targetUids, {
            source: true,
            envelope: true,
            uid: true,
          })) {
            if (!msg.source) continue;
            try {
              const parsed = await simpleParser(msg.source);
              const fromAddress = (
                parsed.from?.value?.[0]?.address ||
                msg.envelope?.from?.[0]?.address ||
                ''
              )
                .toLowerCase()
                .trim();
              const fromName =
                parsed.from?.value?.[0]?.name || msg.envelope?.from?.[0]?.name || undefined;
              const subject = parsed.subject || msg.envelope?.subject || '(No Subject)';
              const bodyText =
                parsed.text ||
                (typeof parsed.html === 'string'
                  ? parsed.html.replace(/<[^>]+>/g, ' ')
                  : '') ||
                '';

              const myImapUser = (config.imap.user || '').toLowerCase().trim();
              const mySmtpUser = (config.smtp.user || '').toLowerCase().trim();
              const isSelf = fromAddress === myImapUser || fromAddress === mySmtpUser;

              const isProviderNoReply = fromAddress.includes('no-reply@infomaniak.com');
              const isBounceNotification =
                fromAddress.includes('mailer-daemon') ||
                fromAddress.includes('postmaster') ||
                /delivery status notification|undelivered mail|mail delivery failed|failure notice/i.test(
                  subject
                );

              if (isSelf || isProviderNoReply || !bodyText.trim()) {
                continue;
              }

              let bouncedRecipient: string | undefined;
              if (isBounceNotification) {
                const recipientMatch = bodyText.match(
                  /(?:Final-Recipient:\s*rfc822;|Original-Recipient:\s*rfc822;|<)([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i
                );
                if (recipientMatch) {
                  bouncedRecipient = recipientMatch[1].toLowerCase().trim();
                }
              }

              const refsRaw = parsed.references;
              const references = Array.isArray(refsRaw)
                ? refsRaw
                : typeof refsRaw === 'string'
                ? [refsRaw]
                : [];

              const durableKey = computeDurableMessageKey({
                messageId: parsed.messageId,
                uidValidity: mailboxUidValidity,
                uid: msg.uid,
                senderEmail: fromAddress,
                subject,
                bodyText,
              });

              parsedEmails.push({
                uid: msg.uid,
                email: {
                  senderEmail: fromAddress,
                  senderName: fromName,
                  subject,
                  bodyText: bodyText.trim(),
                  latestReplyText: extractLatestReplyText(bodyText),
                  receivedAt: parsed.date || new Date(),
                  messageId: durableKey,
                  inReplyTo: parsed.inReplyTo || null,
                  references,
                  uid: msg.uid,
                  uidValidity: mailboxUidValidity,
                  isBounce: isBounceNotification,
                  bouncedRecipient,
                },
              });
            } catch (parseErr: any) {
              console.warn('[IMAP] Failed to parse message body:', parseErr?.message);
            }
          }
        }

        // Process each message and ONLY mark as \Seen after successful processing
        const succeededUids: number[] = [];
        for (const item of parsedEmails) {
          try {
            await onNewEmail(item.email);
            succeededUids.push(item.uid);
            processedCount++;
          } catch (procErr: any) {
            console.error(
              '[IMAP] Message processing failed (leaving unseen for retry):',
              item.email.senderEmail,
              procErr?.message
            );
          }
        }

        if (succeededUids.length > 0) {
          await client
            .messageFlagsAdd(succeededUids, ['\\Seen'], { uid: true })
            .catch(() => {});
        }
      } finally {
        lock.release();
      }

      await client.logout();
      this.lastPoll = {
        ...this.lastPoll,
        completedAt: new Date().toISOString(),
        success: true,
        processedCount,
        error: null,
      };
      return { success: true, processedCount };
    } catch (err: any) {
      console.error('[IMAP] Poll error:', err?.message);
      const error = err?.responseText || err?.message || 'IMAP connection failed';
      this.lastPoll = {
        ...this.lastPoll,
        completedAt: new Date().toISOString(),
        success: false,
        processedCount,
        error,
      };
      return {
        success: false,
        processedCount,
        error,
      };
    } finally {
      this.isPollInFlight = false;
    }
  }

  startPolling(onNewEmail: (email: IncomingRawEmail) => Promise<void>, intervalMs = 60000) {
    if (this.isPollingLoopActive) return;
    this.isPollingLoopActive = true;

    console.log(
      `[IMAP] Live poller scheduled every ${intervalMs / 1000}s on ${config.imap.host}:${config.imap.port} for <${config.imap.user}>`
    );

    const runPoll = async () => {
      await this.pollOnce(onNewEmail);
    };

    // Do not leave new replies waiting for the first interval after a deploy/restart.
    // Subsequent polls remain serialized by pollOnce's overlap guard.
    void runPoll();
    this.intervalHandle = setInterval(() => {
      void runPoll();
    }, intervalMs);
  }

  stopPolling() {
    this.isPollingLoopActive = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }
}

export const imapService = new ImapService();
