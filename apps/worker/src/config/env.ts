import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: true });
}

const smtpPort = Number(process.env.SMTP_PORT) || 587;
const smtpSecure =
  process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === 'true'
    : smtpPort === 465;

const rawSmtpPass = process.env.SMTP_PASS?.trim() || '';
const rawImapPass = process.env.IMAP_PASS?.trim() || '';

// Prefer IMAP_PASS when SMTP_PASS is missing or holds a stale placeholder
const activeSmtpPass =
  rawSmtpPass && rawSmtpPass !== 'Thisforinfomaniak@1'
    ? rawSmtpPass
    : rawImapPass;

const activeImapPass =
  rawImapPass && rawImapPass !== 'Thisforinfomaniak@1'
    ? rawImapPass
    : activeSmtpPass;

export const config = {
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  smtp: {
    host: process.env.SMTP_HOST || 'mail.infomaniak.com',
    port: smtpPort,
    secure: smtpSecure,
    user: process.env.SMTP_USER || 'info@jimyexport.ch',
    pass: activeSmtpPass,
  },
  imap: {
    host: process.env.IMAP_HOST || 'mail.infomaniak.com',
    port: Number(process.env.IMAP_PORT) || 993,
    user: process.env.IMAP_USER || process.env.SMTP_USER || 'info@jimyexport.ch',
    pass: activeImapPass,
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  googlePlaces: {
    apiKey: process.env.GOOGLE_PLACES_API_KEY || '',
  },
  foursquare: { apiKey: process.env.FOURSQUARE_API_KEY || '' },
  // OpenStreetMap needs no key: default to the public Overpass endpoint so
  // discovery has a second live source even without OSM_OVERPASS_URL set.
  // Set OSM_OVERPASS_URL to use a different mirror.
  openStreetMap: { overpassUrl: process.env.OSM_OVERPASS_URL || 'https://overpass-api.de/api/interpreter' },
  zefix: {
    username: process.env.ZEFIX_USERNAME || '',
    password: process.env.ZEFIX_PASSWORD || '',
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
