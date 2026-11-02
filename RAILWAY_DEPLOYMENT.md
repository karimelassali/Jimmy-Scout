# Railway production deployment

JimiScout runs as one persistent Railway web service. The same Node process serves the dashboard/API and runs the inbound, discovery, and outreach schedulers.

## Service settings

- Source: this GitHub repository, branch `main`
- Builder: Dockerfile (detected automatically)
- Replicas: **1** (required so scheduled work is not duplicated)
- Public networking: enabled
- Healthcheck path: `/api/health`
- Restart policy: Always
- Auto-deploy: enabled for `main`

Railway injects `PORT`; the server already listens on that port at `0.0.0.0`.

## Required Railway variables

Copy the real values from the existing secure environment. Never commit them.

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
GEMINI_API_KEY
GOOGLE_PLACES_API_KEY
FOURSQUARE_API_KEY
OSM_OVERPASS_URL
ZEFIX_USERNAME
ZEFIX_PASSWORD
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASS
IMAP_HOST
IMAP_PORT
IMAP_USER
IMAP_PASS
TELEGRAM_BOT_TOKEN
TELEGRAM_CLIENT_CHAT_ID
JIMISCOUT_ADMIN_TOKEN
WEBHOOK_SECRET
TIMEZONE=Europe/Zurich
```

Railway is detected automatically and refuses to start without Supabase cloud credentials. It never falls back to a file inside the container.

## Database

Apply all SQL files in `supabase/migrations/` to the production Supabase project, including `20261102010000_company_discovery.sql`, before enabling Jimy.

## Release check

1. Confirm `/api/health` returns `status: ok` and `storage_mode: supabase-sql` (or `supabase-storage` while migrations are pending).
2. Confirm at least one discovery provider is configured (`google_places_configured`, `foursquare_configured`, or `openstreetmap_configured`). Zefix credentials are optional verification enrichment.
3. Keep Jimy paused until the discovery and outreach switches have been reviewed.
4. Enable the master switch from the Railway-hosted dashboard.
