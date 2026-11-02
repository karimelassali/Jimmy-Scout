// Supabase's current realtime client expects a WebSocket global. Node 22 ships
// one, while the Node 20 runtime used by some local installations does not.
if (!globalThis.WebSocket) {
  const { WebSocket } = await import('ws');
  globalThis.WebSocket = WebSocket as any;
}
