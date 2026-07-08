import ws from "ws";

// Node <22 lacks native WebSocket; Supabase realtime client requires it at init.
(globalThis as typeof globalThis & { WebSocket: typeof ws }).WebSocket =
  ws as unknown as typeof WebSocket;
