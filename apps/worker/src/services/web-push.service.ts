import webpush from 'web-push';
import { supabaseDataService } from './supabase.service.ts';

type BrowserPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

class WebPushService {
  private readonly publicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  private readonly privateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
  private readonly subject = (process.env.VAPID_SUBJECT || 'mailto:info@jimyexport.ch').trim();

  constructor() {
    if (this.publicKey && this.privateKey) {
      webpush.setVapidDetails(this.subject, this.publicKey, this.privateKey);
    }
  }

  getPublicKey(): string | null {
    return this.publicKey || null;
  }

  isConfigured(): boolean {
    return Boolean(this.publicKey && this.privateKey);
  }

  async notifyNewLead(lead: {
    id: string;
    company_name?: string;
    canton?: string;
    ai_summary?: string | null;
  }): Promise<void> {
    if (!this.isConfigured()) return;

    const subscriptions = await supabaseDataService.getPushSubscriptions();
    const payload = JSON.stringify({
      title: 'Nouvelle réponse société',
      body: `${lead.company_name || 'Société'} · ${lead.ai_summary || `Nouvelle offre en ${lead.canton || 'Suisse'}`}`,
      url: `/?tab=leads&leadId=${encodeURIComponent(lead.id)}`,
      tag: `lead-${lead.id}`,
    });

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(subscription, payload, { TTL: 60 * 60 });
        } catch (error: any) {
          // Expired/revoked browser subscriptions must not make inbound mail processing fail.
          if (error?.statusCode === 404 || error?.statusCode === 410) {
            await supabaseDataService.deletePushSubscription(subscription.endpoint);
          } else {
            console.warn('[Web Push] Notification delivery failed:', error?.message || error);
          }
        }
      })
    );
  }
}

export type { BrowserPushSubscription };
export const webPushService = new WebPushService();
