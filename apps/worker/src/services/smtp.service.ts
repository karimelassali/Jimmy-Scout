import nodemailer, { type Transporter } from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/env.ts';

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
  fromName?: string;
  inReplyTo?: string;
  references?: string[];
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: any;
    cid?: string;
    contentType?: string;
  }>;
}

export class SmtpService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter(overridePass?: string, overridePort?: number, overrideSecure?: boolean) {
    const password = overridePass || config.smtp.pass;
    if (!config.smtp.host || !config.smtp.user || !password) {
      return;
    }

    const port = overridePort !== undefined ? overridePort : config.smtp.port;
    const secure = overrideSecure !== undefined ? overrideSecure : config.smtp.secure;

    this.transporter = nodemailer.createTransport({
      host: config.smtp.host.trim(),
      port,
      secure,
      auth: {
        user: config.smtp.user.trim(),
        pass: password.trim(),
      },
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  async sendMail(options: SendMailOptions): Promise<{
    success: boolean;
    messageId?: string;
    deliveryStatus?: 'accepted' | 'simulated' | 'failed' | 'bounced';
    error?: string;
  }> {
    if (process.env.JIMISCOUT_STUB_EXTERNAL === 'true') {
      return {
        success: true,
        messageId: `<stub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@jimyexport.ch>`,
        deliveryStatus: 'simulated',
      };
    }

    this.initTransporter();

    if (!this.transporter) {
      return {
        success: false,
        deliveryStatus: 'failed',
        error: 'SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are not configured.',
      };
    }

    const attachments = options.attachments ? [...options.attachments] : [];
    const hasAvatarAttachment = attachments.some((att) => att.cid === 'jimy_export_profile_pic');

    if (!hasAvatarAttachment) {
      const potentialAvatarPaths = [
        path.resolve(process.cwd(), 'public/assets/jimy-export-avatar.jpg'),
        path.resolve(process.cwd(), 'public/assets/jimy-export-avatar.png'),
        path.resolve(process.cwd(), 'dist/assets/jimy-export-avatar.jpg'),
      ];
      for (const p of potentialAvatarPaths) {
        if (fs.existsSync(p)) {
          attachments.push({
            filename: 'jimy-export-avatar.jpg',
            path: p,
            cid: 'jimy_export_profile_pic',
            contentType: 'image/jpeg',
          });
          break;
        }
      }
    }

    const senderDisplayName = options.fromName || 'Jamal - JIMY EXPORT';

    const mailPayload: Record<string, any> = {
      from: `"${senderDisplayName}" <${config.smtp.user.trim()}>`,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      replyTo: options.replyTo || config.smtp.user.trim(),
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    if (options.inReplyTo) {
      mailPayload.inReplyTo = options.inReplyTo;
    }
    if (options.references && options.references.length > 0) {
      mailPayload.references = options.references;
    }

    try {
      const info = await this.transporter.sendMail(mailPayload);
      return {
        success: true,
        messageId: info.messageId,
        deliveryStatus: 'accepted',
      };
    } catch (firstError: any) {
      const errMsg = firstError?.message || '';
      console.warn('[SMTP] First send attempt failed:', errMsg);

      // If port 587 STARTTLS had a transport timeout, retry on port 465 SSL
      if (config.smtp.port === 587 && !errMsg.includes('535')) {
        try {
          this.initTransporter(config.smtp.pass, 465, true);
          if (this.transporter) {
            const info = await this.transporter.sendMail(mailPayload);
            return {
              success: true,
              messageId: info.messageId,
              deliveryStatus: 'accepted',
            };
          }
        } catch (portRetryErr: any) {
          console.error('[SMTP] Port 465 fallback failed:', portRetryErr?.message);
        }
      }

      const isBounce = /550|551|552|553|554|user unknown|mailbox unavailable/i.test(errMsg);
      return {
        success: false,
        deliveryStatus: isBounce ? 'bounced' : 'failed',
        error: errMsg || 'SMTP transmission failed',
      };
    }
  }

  async verifyConnection(): Promise<{ connected: boolean; error?: string }> {
    if (process.env.JIMISCOUT_STUB_EXTERNAL === 'true') {
      return { connected: true };
    }
    this.initTransporter();
    if (!this.transporter) {
      return { connected: false, error: 'Missing SMTP credentials' };
    }
    try {
      await this.transporter.verify();
      return { connected: true };
    } catch (err: any) {
      return { connected: false, error: err?.message || 'SMTP verification failed' };
    }
  }
}

export const smtpService = new SmtpService();
