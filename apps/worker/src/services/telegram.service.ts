import { config } from '../config/env.ts';
import { DetectedMachinery } from '@/packages/types/src/lead.ts';

export interface TelegramDealAlert {
  companyName: string;
  canton: string;
  machinery: DetectedMachinery[];
  askingPrice?: string;
  sellerName?: string;
  sellerPhone?: string;
  sellerEmail: string;
  summary: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export class TelegramService {
  /**
   * Dispatches a real mobile push notification via Telegram Bot API
   */
  async sendDealNotification(deal: TelegramDealAlert): Promise<{
    success: boolean;
    messageId?: number;
    botUsername?: string;
    error?: string;
  }> {
    const token = config.telegram.botToken?.trim();
    const chatId = config.telegram.chatId?.trim();

    if (!token || !chatId) {
      return {
        success: false,
        error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CLIENT_CHAT_ID is not configured.',
      };
    }

    const machineryLine =
      deal.machinery.length > 0
        ? deal.machinery
            .map(
              (m) =>
                `${m.make_model}${m.year ? ` (${m.year})` : ''}${
                  m.hours ? ` • ${m.hours.toLocaleString()} hrs` : ''
                }`
            )
            .join(', ')
        : 'Matériel BTP';

    const price = deal.askingPrice || deal.machinery[0]?.asking_price || 'À négocier';
    const seller = deal.sellerName || 'Responsable Matériel';
    const phone = deal.sellerPhone || 'Non communiqué';
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.APP_URL ||
      'https://app.jimiexport.ch';

    const messageText = `🚨 <b>NOUVELLE OFFRE DE MACHINE DISPONIBLE</b>

🏢 <b>Entreprise:</b> ${escapeHtml(deal.companyName)} (${escapeHtml(deal.canton)})
🚜 <b>Matériel:</b> ${escapeHtml(machineryLine)}
💰 <b>Prix demandé:</b> ${escapeHtml(price)}
👤 <b>Vendeur:</b> ${escapeHtml(seller)}
📞 <b>Tél:</b> ${escapeHtml(phone)}
✉️ <b>Email:</b> ${escapeHtml(deal.sellerEmail)}

📝 <b>Résumé:</b> "${escapeHtml(deal.summary)}"

🔗 <a href="${appUrl}">Ouvrir dans JimiScout CRM</a>`;

    try {
      const url = `https://api.telegram.org/bot${token}/sendMessage`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: messageText,
          parse_mode: 'HTML',
          disable_web_page_preview: true,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        console.error('[Telegram] API error:', data?.description);
        return {
          success: false,
          error: data?.description || 'Telegram API rejected message',
        };
      }

      return {
        success: true,
        messageId: data?.result?.message_id,
      };
    } catch (err: any) {
      console.error('[Telegram] Dispatch failed:', err?.message);
      return {
        success: false,
        error: err?.message || 'Network failure contacting Telegram API',
      };
    }
  }

  async verifyBot(): Promise<{
    connected: boolean;
    username?: string;
    chatId?: string;
    error?: string;
  }> {
    const token = config.telegram.botToken?.trim();
    const chatId = config.telegram.chatId?.trim();
    if (!token) {
      return { connected: false, error: 'Missing TELEGRAM_BOT_TOKEN' };
    }
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await res.json();
      if (data.ok) {
        return {
          connected: true,
          username: data.result?.username,
          chatId,
        };
      }
      return { connected: false, error: data.description || 'Invalid token' };
    } catch (err: any) {
      return { connected: false, error: err?.message };
    }
  }
}

export const telegramService = new TelegramService();
