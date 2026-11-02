// Test bootstrap must run before ESM dependency evaluation. Node 20 does not
// expose a native WebSocket, while the installed Supabase client expects one.
await import('../scripts/node20-compat.ts');

process.env.JIMISCOUT_STUB_EXTERNAL = 'true';
process.env.JIMISCOUT_USE_MEMORY_ONLY = 'true';
process.env.JIMISCOUT_DISABLE_DAEMON = 'true';
process.env.JIMISCOUT_ADMIN_TOKEN = 'test-admin-secret-token-2026';
process.env.WEBHOOK_SECRET = 'test-webhook-secret-2026';
