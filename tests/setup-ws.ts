import ws from "ws";

// Node <22 lacks native WebSocket; Supabase realtime client requires it at init.
(globalThis as unknown as { WebSocket: typeof ws }).WebSocket = ws;
