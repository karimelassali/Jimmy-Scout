import dotenv from 'dotenv';
dotenv.config({ override: true });

const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpSecure =
  process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === 'true'
    : smtpPort === 465;

export const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  smtp: {
    host: process.env.SMTP_HOST || 'mail.infomaniak.com',
    port: smtpPort,
    secure: smtpSecure,
    user: process.env.SMTP_USER || 'info@jimyexport.ch',
    pass: process.env.SMTP_PASS || '',
  },
  imap: {
    host: process.env.IMAP_HOST || 'mail.infomaniak.com',
    port: Number(process.env.IMAP_PORT) || 993,
    user: process.env.IMAP_USER || process.env.SMTP_USER || 'info@jimyexport.ch',
    pass: process.env.IMAP_PASS || process.env.SMTP_PASS || '',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    chatId: process.env.TELEGRAM_CLIENT_CHAT_ID || '',
  },
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  },
  timezone: process.env.TIMEZONE || 'Europe/Zurich',
};
