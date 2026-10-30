import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';
import { config } from '../config/env.ts';

export interface IncomingRawEmail {
  senderEmail: string;
  senderName?: string;
  subject: string;
  bodyText: string;
  receivedAt: Date;
  messageId?: string;
}

export class ImapService {
  private isPolling = false;
  private intervalHandle: NodeJS.Timeout | null = null;

  /**
   * Connects to the real IMAP inbox, fetches unseen messages, parses them with mailparser,
   * marks them seen, and passes each message to the handler.
   */
  async pollOnce(
    onNewEmail: (email: IncomingRawEmail) => Promise<void>
  ): Promise<{
    success: boolean;
    processedCount: number;
    error?: string;
  }> {
    if (!config.imap.host || !config.imap.user || !config.imap.pass) {
      return {
        success: false,
        processedCount: 0,
        error: 'IMAP credentials (IMAP_HOST, IMAP_USER, IMAP_PASS) are not configured.',
      };
    }

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

    const parsedEmails: IncomingRawEmail[] = [];
    const uidsToMarkSeen: number[] = [];

    try {
      await client.connect();
      const lock = await client.getMailboxLock('INBOX');

      try {
        const unseenUids = await client.search({ seen: false });
        if (unseenUids && unseenUids.length > 0) {
          for await (const msg of client.fetch(unseenUids, {
            source: true,
            envelope: true,
            uid: true,
          })) {
            if (!msg.source) continue;
            try {
              const parsed = await simpleParser(msg.source);
              const fromAddress =
                parsed.from?.value?.[0]?.address ||
                msg.envelope?.from?.[0]?.address ||
                'unknown@contractor.ch';
              const fromName =
                parsed.from?.value?.[0]?.name || msg.envelope?.from?.[0]?.name || undefined;
              const subject = parsed.subject || msg.envelope?.subject || '(No Subject)';
              const bodyText =
                parsed.text ||
                (typeof parsed.html === 'string'
                  ? parsed.html.replace(/<[^>]+>/g, ' ')
                  : '') ||
                '';

              if (bodyText.trim()) {
                parsedEmails.push({
                  senderEmail: fromAddress,
                  senderName: fromName,
                  subject,
                  bodyText: bodyText.trim(),
                  receivedAt: parsed.date || new Date(),
                  messageId: parsed.messageId || String(msg.uid),
                });
                uidsToMarkSeen.push(msg.uid);
              }
            } catch (parseErr: any) {
              console.warn('[IMAP] Failed to parse message body:', parseErr?.message);
            }
          }

          if (uidsToMarkSeen.length > 0) {
            await client.messageFlagsAdd(uidsToMarkSeen, ['\\Seen'], { uid: true });
          }
        }
      } finally {
        lock.release();
      }

      await client.logout();
    } catch (err: any) {
      console.error('[IMAP] Poll error:', err?.message);
      return {
        success: false,
        processedCount: 0,
        error: err?.responseText || err?.message || 'IMAP connection failed',
      };
    }

    // Process parsed emails with onNewEmail handler outside of the IMAP connection lock
    let processedCount = 0;
    for (const email of parsedEmails) {
      try {
        await onNewEmail(email);
        processedCount++;
      } catch (procErr: any) {
        console.error('[IMAP] Message processing error for', email.senderEmail, procErr?.message);
      }
    }

    return { success: true, processedCount };
  }

  startPolling(onNewEmail: (email: IncomingRawEmail) => Promise<void>, intervalMs = 60000) {
    if (this.isPolling) return;
    this.isPolling = true;

    console.log(
      `[IMAP] Live poller scheduled every ${intervalMs / 1000}s on ${config.imap.host}:${config.imap.port} for <${config.imap.user}>`
    );

    this.intervalHandle = setInterval(async () => {
      await this.pollOnce(onNewEmail);
    }, intervalMs);
  }

  stopPolling() {
    this.isPolling = false;
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle);
      this.intervalHandle = null;
    }
  }
}

export const imapService = new ImapService();
