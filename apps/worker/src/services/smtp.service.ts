import nodemailer, { type Transporter } from 'nodemailer';
import { config } from '../config/env.ts';

export interface SendMailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}

export class SmtpService {
  private transporter: Transporter | null = null;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    if (!config.smtp.host || !config.smtp.user || !config.smtp.pass) {
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: config.smtp.host.trim(),
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user.trim(),
        pass: config.smtp.pass.trim(),
      },
    });
  }

  async sendMail(options: SendMailOptions): Promise<{
    success: boolean;
    messageId?: string;
    error?: string;
  }> {
    this.initTransporter();

    if (!this.transporter) {
      return {
        success: false,
        error: 'SMTP credentials (SMTP_HOST, SMTP_USER, SMTP_PASS) are not configured.',
      };
    }

    try {
      const info = await this.transporter.sendMail({
        from: `"JimiScout BTP" <${config.smtp.user.trim()}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
        replyTo: options.replyTo || config.smtp.user.trim(),
      });
      return {
        success: true,
        messageId: info.messageId,
      };
    } catch (error: any) {
      console.error('[SMTP] Real dispatch error:', error?.message);
      return {
        success: false,
        error: error?.message || 'SMTP transmission failed',
      };
    }
  }

  async verifyConnection(): Promise<{ connected: boolean; error?: string }> {
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
